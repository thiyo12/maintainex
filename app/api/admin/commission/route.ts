import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { createWorkItem } from '@/lib/work-queue'
import crypto from 'crypto'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

function generateReferenceNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = 'REF-'
  const bytes = crypto.randomBytes(5)
  for (let i = 0; i < 5; i++) {
    ref += chars[bytes[i] % chars.length]
  }
  return ref
}

async function createCommissionPayment(settlementId: string, providerId: string, amountDue: number): Promise<string> {
  let referenceNumber = generateReferenceNumber()
  let attempts = 0
  while (attempts < 10) {
    const existing = await prisma.commissionPayment.findUnique({
      where: { referenceNumber }
    })
    if (!existing) break
    referenceNumber = generateReferenceNumber()
    attempts++
  }
  const payment = await prisma.commissionPayment.create({
    data: {
      providerId,
      weeklySettlementId: settlementId,
      referenceNumber,
      amountDue,
      method: 'CASH',
      status: 'PENDING',
    }
  })
  return payment.referenceNumber
}

// GET: List commission settlements derived from canonical CommissionSettlement records
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

    const where: any = {}
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

    const summary = await prisma.commissionSettlement.aggregate({
      where: { status: 'PENDING' },
      _sum: { commissionAmount: true, jobAmount: true },
      _count: true,
    })

    const settledSummary = await prisma.commissionSettlement.aggregate({
      where: { status: 'SETTLED' },
      _sum: { commissionAmount: true },
      _count: true,
    })

    return NextResponse.json({
      settlements,
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

// POST: Settle pending canonical CommissionSettlement records for a provider
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
      where: { providerId, status: 'PENDING' },
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
      settlements: settled,
      totalCommission,
      count: settled.length,
    })
  } catch (error) {
    console.error('Commission POST error:', error)
    return NextResponse.json({ error: 'Failed to settle commission' }, { status: 500 })
  }
}

// PUT: Legacy WeeklySettlement actions (MARK_PAID, MARK_OVERDUE, SUSPEND, UNSUSPEND)
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

    let updateData: any = {}

    switch (action) {
      case 'MARK_PAID':
        updateData = {
          commissionPaid: true,
          paidAt: new Date(),
          status: 'PAID'
        }
        break
      case 'MARK_OVERDUE':
        updateData = {
          status: 'OVERDUE'
        }
        const overdueSettlement = await prisma.weeklySettlement.findUnique({
          where: { id: settlementId },
          select: { providerId: true, providerType: true, commissionOwed: true, weekStart: true, weekEnd: true }
        })
        if (overdueSettlement) {
          await createWorkItem({
            category: 'settlement',
            title: `Weekly settlement overdue — ${overdueSettlement.providerType}`,
            description: `Provider ${overdueSettlement.providerId} has an overdue commission of ${(overdueSettlement.commissionOwed / 100).toFixed(2)} for week ${overdueSettlement.weekStart.toISOString().split('T')[0]} to ${overdueSettlement.weekEnd.toISOString().split('T')[0]}.`,
            targetTable: 'WeeklySettlement',
            targetId: settlementId,
            severity: 'high',
            priority: 'high',
          })
        }
        break
      case 'SUSPEND':
        updateData = {
          status: 'SUSPENDED',
          suspendedAt: new Date()
        }
        const settlement = await prisma.weeklySettlement.findUnique({
          where: { id: settlementId }
        })
        if (settlement) {
          await prisma.user.update({
            where: { id: settlement.providerId },
            data: {
              isSuspended: true,
              suspensionReason: 'Weekly commission not paid',
              suspendedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          })
        }
        break
      case 'UNSUSPEND':
        updateData = {
          status: 'PAID',
          commissionPaid: true,
          paidAt: new Date()
        }
        const settlementToUnsuspend = await prisma.weeklySettlement.findUnique({
          where: { id: settlementId }
        })
        if (settlementToUnsuspend) {
          await prisma.user.update({
            where: { id: settlementToUnsuspend.providerId },
            data: {
              isSuspended: false,
              suspensionReason: null,
              suspendedUntil: null
            }
          })
        }
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const settlement = await prisma.weeklySettlement.update({
      where: { id: settlementId },
      data: updateData
    })

    return NextResponse.json({ settlement })
  } catch (error) {
    console.error('Commission PUT error:', error)
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 })
  }
}
