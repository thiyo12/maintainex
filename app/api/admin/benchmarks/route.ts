import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { getCountryFilter } from '@/lib/auth/authorization/admin-rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'FINANCE', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const serviceTemplateId = searchParams.get('serviceTemplateId')
    const countryCode = searchParams.get('countryCode')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const countryFilter = getCountryFilter(session)

    const where: Record<string, unknown> = {
      ...countryFilter,
    }
    if (status) where.status = status
    if (serviceTemplateId) where.serviceTemplateId = serviceTemplateId
    if (countryCode) where.countryCode = countryCode

    const [benchmarks, total] = await Promise.all([
      prisma.priceBenchmark.findMany({
        where,
        orderBy: [{ countryCode: 'asc' }, { region: 'asc' }, { city: 'asc' }, { version: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.priceBenchmark.count({ where }),
    ])

    const summary = await prisma.priceBenchmark.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    return NextResponse.json({
      benchmarks,
      summary: Object.fromEntries(summary.map(s => [s.status, s._count.status])),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Benchmarks GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'FINANCE'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      serviceTemplateId,
      countryCode,
      region,
      city,
      currency,
      pricingMode,
      sampleSize,
      medianAmountCents,
      lowerPercentileCents,
      upperPercentileCents,
      minimumObservedCents,
      maximumObservedCents,
      sourceType,
      sourceReference,
      methodologyNote,
      effectiveFrom,
      effectiveTo,
    } = body

    if (!serviceTemplateId || !countryCode || !currency || !sourceType) {
      return NextResponse.json(
        { error: 'serviceTemplateId, countryCode, currency, and sourceType are required' },
        { status: 400 }
      )
    }

    // Determine geography level
    let geographyLevel = 'COUNTRY'
    if (city) geographyLevel = 'CITY'
    else if (region) geographyLevel = 'PROVINCE'

    // Determine next version for this geography
    const latestVersion = await prisma.priceBenchmark.findFirst({
      where: {
        serviceTemplateId,
        countryCode,
        region: region ?? null,
        city: city ?? null,
        status: { not: 'SUPERSEDED' },
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const benchmark = await prisma.priceBenchmark.create({
      data: {
        serviceTemplateId,
        countryCode,
        region: region ?? null,
        city: city ?? null,
        currency,
        pricingMode: pricingMode ?? 'SMART_QUOTE',
        sampleSize: sampleSize ?? 0,
        medianAmountCents: BigInt(medianAmountCents),
        lowerPercentileCents: BigInt(lowerPercentileCents ?? medianAmountCents),
        upperPercentileCents: BigInt(upperPercentileCents ?? medianAmountCents),
        minimumObservedCents: BigInt(minimumObservedCents ?? medianAmountCents),
        maximumObservedCents: BigInt(maximumObservedCents ?? medianAmountCents),
        sourceType,
        sourceReference: sourceReference ?? null,
        methodologyNote: methodologyNote ?? null,
        geographyLevel,
        status: 'DRAFT',
        version: (latestVersion?.version ?? 0) + 1,
        createdBy: session.id,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
    })

    return NextResponse.json({ benchmark }, { status: 201 })
  } catch (error) {
    console.error('Benchmarks POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
