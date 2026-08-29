import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCommissionRate, calculateCommission } from '@/lib/mxid'
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

// GET: List all commission settlements with optional filters
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING, PAID, OVERDUE, SUSPENDED
    const providerType = searchParams.get('providerType') // TASKER, COMPANY
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status
    if (providerType) where.providerType = providerType

    const settlements = await prisma.weeklySettlement.findMany({
      where,
      orderBy: { weekStart: 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.weeklySettlement.count({ where })

    // Calculate summary stats
    const summary = await prisma.weeklySettlement.aggregate({
      where: { status: 'PENDING' },
      _sum: { commissionOwed: true, totalEarnings: true },
      _count: true
    })

    const overdueSummary = await prisma.weeklySettlement.aggregate({
      where: { status: 'OVERDUE' },
      _sum: { commissionOwed: true },
      _count: true
    })

    return NextResponse.json({
      settlements,
      summary: {
        pendingCommission: summary._sum.commissionOwed || 0,
        pendingEarnings: summary._sum.totalEarnings || 0,
        pendingCount: summary._count,
        overdueCommission: overdueSummary._sum.commissionOwed || 0,
        overdueCount: overdueSummary._count
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Commission GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commission settlements' }, { status: 500 })
  }
}

// POST: Create weekly settlement for a provider
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { providerId, providerType, weekStart } = body

    if (!providerId || !providerType || !weekStart) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const startDate = new Date(weekStart)
    const weekEnd = new Date(startDate)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const dueAt = new Date(weekEnd)
    dueAt.setDate(dueAt.getDate() + 7)

    const commissionRate = await getCommissionRate()

    // Calculate total earnings for the week from completed jobs
    const totalEarnings = await calculateWeeklyEarnings(providerId, startDate, weekEnd)
    const commissionOwed = calculateCommission(totalEarnings, commissionRate)

    const settlement = await prisma.weeklySettlement.upsert({
      where: {
        providerId_weekStart: {
          providerId,
          weekStart: startDate
        }
      },
      create: {
        providerId,
        providerType,
        weekStart: startDate,
        weekEnd,
        totalEarnings,
        commissionRate,
        commissionOwed,
        dueAt,
        status: commissionOwed > 0 ? 'PENDING' : 'PAID'
      },
      update: {
        totalEarnings,
        commissionRate,
        commissionOwed,
        status: commissionOwed > 0 ? 'PENDING' : 'PAID'
      }
    })

    let commissionPaymentRef: string | null = null
    if (commissionOwed > 0) {
      commissionPaymentRef = await createCommissionPayment(settlement.id, providerId, commissionOwed)
    }

    return NextResponse.json({ settlement, commissionPaymentRef })
  } catch (error) {
    console.error('Commission POST error:', error)
    return NextResponse.json({ error: 'Failed to create settlement' }, { status: 500 })
  }
}

// PUT: Mark settlement as paid
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
        // Create work queue item for overdue settlement
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
        // Also suspend the provider
        const settlement = await prisma.weeklySettlement.findUnique({
          where: { id: settlementId }
        })
        if (settlement) {
          await prisma.user.update({
            where: { id: settlement.providerId },
            data: {
              isSuspended: true,
              suspensionReason: 'Weekly commission not paid',
              suspendedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
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

// Helper: Calculate weekly earnings for a provider
async function calculateWeeklyEarnings(providerId: string, weekStart: Date, weekEnd: Date): Promise<number> {
  // Get completed jobs in the week from MarketplaceJob
  const jobs = await prisma.marketplaceJob.findMany({
    where: {
      customerId: providerId, // This is actually the provider in JobQuote context
      status: 'COMPLETED',
      updatedAt: {
        gte: weekStart,
        lte: weekEnd
      }
    }
  })

  // Also check JobQuote accepted jobs
  const quotes = await prisma.jobQuote.findMany({
    where: {
      providerId,
      status: 'ACCEPTED',
      updatedAt: {
        gte: weekStart,
        lte: weekEnd
      }
    }
  })

  let totalEarnings = 0

  // Sum up job amounts
  for (const job of jobs) {
    totalEarnings += Number(job.budgetAmount) / 100 // Convert from cents
  }

  // Sum up quote amounts
  for (const quote of quotes) {
    totalEarnings += Number(quote.price) / 100 // Convert from cents
  }

  return totalEarnings
}
