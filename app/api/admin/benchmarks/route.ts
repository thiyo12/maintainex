import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import {
  boundedInteger,
  parseBenchmarkCents,
  safeText,
  serializeBigInts,
} from '@/lib/crm/benchmark-utils'
import { createAuditLog } from '@/lib/crm/audit'

const VALID_PRICING_MODES = new Set(['INSTANT_PRICE', 'SMART_QUOTE', 'INSPECTION_FIRST'])
const VALID_SOURCE_TYPES = new Set([
  'MAINTAINEX_COMPLETED_JOBS',
  'MANUAL_MARKET_RESEARCH',
  'PUBLIC_PROVIDER_PRICE',
  'PARTNER_DATA',
  'ADMIN_ESTIMATE',
  'OTHER',
])
const VALID_STATUSES = new Set(['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'SUPERSEDED'])

function parseDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid`)
  return date
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'MANAGER'],
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || '').toUpperCase()
    const serviceTemplateId = (searchParams.get('serviceTemplateId') || '').trim().slice(0, 128)
    const countryCode = (searchParams.get('countryCode') || '').trim().toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (countryCode && !assertCrmCountryAllowed(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden country filter' }, { status: 403 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const where: any = { ...countryFilter }
    if (status) where.status = status
    if (serviceTemplateId) where.serviceTemplateId = serviceTemplateId
    if (countryCode) where.countryCode = countryCode

    const [benchmarks, total, summary] = await Promise.all([
      prisma.priceBenchmark.findMany({
        where,
        orderBy: [
          { countryCode: 'asc' },
          { region: 'asc' },
          { city: 'asc' },
          { version: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.priceBenchmark.count({ where }),
      prisma.priceBenchmark.groupBy({
        by: ['status'],
        where: countryFilter,
        _count: { status: true },
      }),
    ])

    return NextResponse.json(
      serializeBigInts({
        benchmarks,
        summary: Object.fromEntries(summary.map(row => [row.status, row._count.status])),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      }),
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM benchmarks GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN', 'FINANCE'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const serviceTemplateId = typeof body?.serviceTemplateId === 'string'
      ? body.serviceTemplateId.trim().slice(0, 128)
      : ''
    const countryCode = typeof body?.countryCode === 'string'
      ? body.countryCode.trim().toUpperCase()
      : ''
    const currency = typeof body?.currency === 'string'
      ? body.currency.trim().toUpperCase()
      : ''
    const pricingMode = typeof body?.pricingMode === 'string'
      ? body.pricingMode.toUpperCase()
      : 'SMART_QUOTE'
    const sourceType = typeof body?.sourceType === 'string'
      ? body.sourceType.toUpperCase()
      : ''

    if (!serviceTemplateId || !countryCode || !/^[A-Z]{3}$/.test(currency) || !VALID_SOURCE_TYPES.has(sourceType)) {
      return NextResponse.json(
        { error: 'Valid serviceTemplateId, countryCode, currency, and sourceType are required' },
        { status: 400 }
      )
    }
    if (!VALID_PRICING_MODES.has(pricingMode)) {
      return NextResponse.json({ error: 'Invalid pricingMode' }, { status: 400 })
    }
    if (!assertCrmCountryAllowed(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const template = await prisma.serviceTemplate.findUnique({
      where: { id: serviceTemplateId },
      select: { id: true, name: true, countryCode: true, currency: true },
    })
    if (!template) {
      return NextResponse.json({ error: 'Service template not found' }, { status: 404 })
    }
    if (template.countryCode !== countryCode) {
      return NextResponse.json({ error: 'Service template country does not match benchmark country' }, { status: 400 })
    }

    try {
      const sampleSize = boundedInteger(body?.sampleSize ?? 0, 'sampleSize', 0, 1_000_000)
      const median = parseBenchmarkCents(body?.medianAmountCents, 'medianAmountCents')
      const lower = parseBenchmarkCents(body?.lowerPercentileCents ?? median, 'lowerPercentileCents')
      const upper = parseBenchmarkCents(body?.upperPercentileCents ?? median, 'upperPercentileCents')
      const minimum = parseBenchmarkCents(body?.minimumObservedCents ?? lower, 'minimumObservedCents')
      const maximum = parseBenchmarkCents(body?.maximumObservedCents ?? upper, 'maximumObservedCents')

      if (!(minimum <= lower && lower <= median && median <= upper && upper <= maximum)) {
        return NextResponse.json(
          { error: 'Benchmark amounts must satisfy minimum ≤ P25 ≤ median ≤ P75 ≤ maximum' },
          { status: 400 }
        )
      }

      const effectiveFrom = parseDate(body?.effectiveFrom, 'effectiveFrom')
      const effectiveTo = parseDate(body?.effectiveTo, 'effectiveTo')
      if (effectiveFrom && effectiveTo && effectiveTo <= effectiveFrom) {
        return NextResponse.json({ error: 'effectiveTo must be after effectiveFrom' }, { status: 400 })
      }

      const region = safeText(body?.region, 160)
      const city = safeText(body?.city, 160)
      const geographyLevel = city ? 'CITY' : region ? 'PROVINCE' : 'COUNTRY'

      const latestVersion = await prisma.priceBenchmark.findFirst({
        where: {
          serviceTemplateId,
          countryCode,
          region,
          city,
          status: { not: 'SUPERSEDED' },
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      })

      const benchmark = await prisma.priceBenchmark.create({
        data: {
          serviceTemplateId,
          countryCode,
          region,
          city,
          currency,
          pricingMode,
          sampleSize,
          medianAmountCents: median,
          lowerPercentileCents: lower,
          upperPercentileCents: upper,
          minimumObservedCents: minimum,
          maximumObservedCents: maximum,
          sourceType,
          sourceReference: safeText(body?.sourceReference, 1000),
          methodologyNote: safeText(body?.methodologyNote, 5000),
          geographyLevel,
          status: 'DRAFT',
          version: (latestVersion?.version ?? 0) + 1,
          createdBy: security.adminId,
          effectiveFrom,
          effectiveTo,
        },
      })

      await createAuditLog({
        action: 'CREATE',
        category: 'FINANCE',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'PriceBenchmark',
        entityId: benchmark.id,
        entityName: template.name,
        description: 'CRM price benchmark draft created',
        newValue: serializeBigInts(benchmark),
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })

      return NextResponse.json({ benchmark: serializeBigInts(benchmark) }, { status: 201 })
    } catch (error) {
      if (error instanceof Error && /required|invalid|integer|range/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    console.error('CRM benchmarks POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
