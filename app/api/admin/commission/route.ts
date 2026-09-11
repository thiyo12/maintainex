import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { getCountryFilter } from '@/lib/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

function serializeSettlement(s: Record<string, unknown>) {
  return {
    ...s,
    jobAmount: Number(s.jobAmount ?? 0),
    commissionAmount: Number(s.commissionAmount ?? 0),
  }
}

// GET: List canonical CommissionSettlement records
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const countryFilter = getCountryFilter(session)
    if (countryFilter.id === '__NONE__') {
      return NextResponse.json({ settlements: [], summary: { pendingCommission: 0, pendingJobAmount: 0, pendingCount: 0, settledCommission: 0, settledCount: 0 }, pagination: { page, limit, total: 0, pages: 0 } })
    }

    const where: any = { ...countryFilter }
    if (status && status !== 'ALL' && status !== '') where.status = status

    const [settlements, total] = await Promise.all([
      prisma.commissionSettlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.commissionSettlement.count({ where }),
    ])

    const summaryWhere = { ...countryFilter, status: 'PENDING' }
    const summary = await prisma.commissionSettlement.aggregate({
      where: summaryWhere,
      _sum: { commissionAmount: true, jobAmount: true },
      _count: true,
    })

    const settledSummaryWhere = { ...countryFilter, status: 'SETTLED' }
    const settledSummary = await prisma.commissionSettlement.aggregate({
      where: settledSummaryWhere,
      _sum: { commissionAmount: true },
      _count: true,
    })

    return NextResponse.json({
      settlements: settlements.map(serializeSettlement),
      summary: {
        pendingCommission: Number(summary._sum.commissionAmount || 0n),
        pendingJobAmount: Number(summary._sum.jobAmount || 0n),
        pendingCount: summary._count,
        settledCommission: Number(settledSummary._sum.commissionAmount || 0n),
        settledCount: settledSummary._count,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Commission GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commission settlements' }, { status: 500 })
  }
}

// POST: Bulk-settle pending CommissionSettlement records for a provider
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { providerId } = body

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 })
    }

    const pendingSettlements = await prisma.commissionSettlement.findMany({
      where: { providerId, status: 'PENDING', ...getCountryFilter(session) },
      orderBy: { createdAt: 'asc' },
    })

    if (pendingSettlements.length === 0) {
      return NextResponse.json({ settlements: [], message: 'No pending settlements' })
    }

    const totalCommission = pendingSettlements.reduce(
      (sum, s) => sum + Number(s.commissionAmount),
      0
    )

    const settled = await prisma.$transaction(async (tx) => {
      await tx.commissionSettlement.updateMany({
        where: { providerId, status: 'PENDING' },
        data: { status: 'SETTLED', settledAt: new Date() },
      })
      return pendingSettlements
    })

    return NextResponse.json({
      settlements: settled.map(serializeSettlement),
      totalCommission,
      count: settled.length,
    })
  } catch (error) {
    console.error('Commission POST error:', error)
    return NextResponse.json({ error: 'Failed to settle commission' }, { status: 500 })
  }
}

// PUT: Settle a single CommissionSettlement record
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { settlementId, action } = body

    if (!settlementId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (action !== 'MARK_SETTLED') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const settlement = await prisma.commissionSettlement.findUnique({
      where: { id: settlementId },
    })
    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      const countryFilter = getCountryFilter(session)
      if (countryFilter.id === '__NONE__') {
        return NextResponse.json({ error: 'No country assigned' }, { status: 403 })
      }
      if (countryFilter.countryCode && !countryFilter.countryCode.in?.includes(settlement.countryCode || 'LK')) {
        return NextResponse.json({ error: 'Forbidden: settlement belongs to a different country' }, { status: 403 })
      }
    }

    if (settlement.status === 'SETTLED') {
      return NextResponse.json({ settlement: serializeSettlement(settlement), message: 'Already settled' })
    }

    const updated = await prisma.commissionSettlement.update({
      where: { id: settlementId },
      data: { status: 'SETTLED', settledAt: new Date() },
    })

    return NextResponse.json({ settlement: serializeSettlement(updated) })
  } catch (error) {
    console.error('Commission PUT error:', error)
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 })
  }
}
