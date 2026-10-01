import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import {
  boundedInteger,
  optionalBenchmarkCents,
  safeText,
  serializeBigInts,
} from '@/lib/crm/benchmark-utils'
import { createAuditLog } from '@/lib/crm/audit'

const VALID_SOURCE_TYPES = new Set([
  'MAINTAINEX_COMPLETED_JOBS',
  'MANUAL_MARKET_RESEARCH',
  'PUBLIC_PROVIDER_PRICE',
  'PARTNER_DATA',
  'ADMIN_ESTIMATE',
  'OTHER',
])

function parseDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid`)
  return date
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'MANAGER'],
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid benchmark ID' }, { status: 400 })

    const benchmark = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!benchmark) return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, benchmark.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(
      { benchmark: serializeBigInts(benchmark) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM benchmark GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN', 'FINANCE'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid benchmark ID' }, { status: 400 })

    const existing = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, existing.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (existing.status === 'PUBLISHED' || existing.status === 'SUPERSEDED') {
      return NextResponse.json(
        { error: 'Cannot modify a published or superseded benchmark. Create a new version instead.' },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}))
    try {
      const data: Record<string, unknown> = {}

      if (body?.sampleSize !== undefined) {
        data.sampleSize = boundedInteger(body.sampleSize, 'sampleSize', 0, 1_000_000)
      }

      const fields = [
        'medianAmountCents',
        'lowerPercentileCents',
        'upperPercentileCents',
        'minimumObservedCents',
        'maximumObservedCents',
      ] as const
      for (const field of fields) {
        const parsed = optionalBenchmarkCents(body?.[field], field)
        if (parsed !== undefined) data[field] = parsed
      }

      if (body?.sourceType !== undefined) {
        const sourceType = String(body.sourceType).toUpperCase()
        if (!VALID_SOURCE_TYPES.has(sourceType)) {
          return NextResponse.json({ error: 'Invalid sourceType' }, { status: 400 })
        }
        data.sourceType = sourceType
      }
      if (body?.sourceReference !== undefined) data.sourceReference = safeText(body.sourceReference, 1000)
      if (body?.methodologyNote !== undefined) data.methodologyNote = safeText(body.methodologyNote, 5000)

      const effectiveFrom = parseDate(body?.effectiveFrom, 'effectiveFrom')
      const effectiveTo = parseDate(body?.effectiveTo, 'effectiveTo')
      if (effectiveFrom !== undefined) data.effectiveFrom = effectiveFrom
      if (effectiveTo !== undefined) data.effectiveTo = effectiveTo

      if (!Object.keys(data).length) {
        return NextResponse.json({ error: 'No valid benchmark fields to update' }, { status: 400 })
      }

      const nextMinimum = (data.minimumObservedCents ?? existing.minimumObservedCents ?? existing.lowerPercentileCents) as bigint
      const nextLower = (data.lowerPercentileCents ?? existing.lowerPercentileCents) as bigint
      const nextMedian = (data.medianAmountCents ?? existing.medianAmountCents) as bigint
      const nextUpper = (data.upperPercentileCents ?? existing.upperPercentileCents) as bigint
      const nextMaximum = (data.maximumObservedCents ?? existing.maximumObservedCents ?? existing.upperPercentileCents) as bigint

      if (!(nextMinimum <= nextLower && nextLower <= nextMedian && nextMedian <= nextUpper && nextUpper <= nextMaximum)) {
        return NextResponse.json(
          { error: 'Benchmark amounts must satisfy minimum ≤ P25 ≤ median ≤ P75 ≤ maximum' },
          { status: 400 }
        )
      }

      const nextFrom = data.effectiveFrom === null
        ? null
        : (data.effectiveFrom as Date | undefined) ?? existing.effectiveFrom
      const nextTo = data.effectiveTo === null
        ? null
        : (data.effectiveTo as Date | undefined) ?? existing.effectiveTo
      if (nextFrom && nextTo && nextTo <= nextFrom) {
        return NextResponse.json({ error: 'effectiveTo must be after effectiveFrom' }, { status: 400 })
      }

      const benchmark = await prisma.priceBenchmark.update({
        where: { id },
        data,
      })

      await createAuditLog({
        action: 'UPDATE',
        category: 'FINANCE',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'PriceBenchmark',
        entityId: existing.id,
        entityName: existing.serviceTemplateId,
        description: 'CRM price benchmark draft updated',
        oldValue: serializeBigInts(existing),
        newValue: serializeBigInts(benchmark),
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })

      return NextResponse.json({ benchmark: serializeBigInts(benchmark) })
    } catch (error) {
      if (error instanceof Error && /required|invalid|integer|range/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }
  } catch (error) {
    console.error('CRM benchmark PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) return NextResponse.json({ error: 'Invalid benchmark ID' }, { status: 400 })

    const existing = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, existing.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (existing.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Cannot delete a published benchmark. Supersede it instead.' },
        { status: 409 }
      )
    }

    await prisma.priceBenchmark.delete({ where: { id } })

    await createAuditLog({
      action: 'DELETE',
      category: 'FINANCE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'PriceBenchmark',
      entityId: existing.id,
      entityName: existing.serviceTemplateId,
      description: 'CRM price benchmark deleted',
      oldValue: serializeBigInts(existing),
      newValue: { deleted: true },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'HIGH',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('CRM benchmark DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
