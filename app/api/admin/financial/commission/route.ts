import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { getCountryFilter } from '@/lib/auth/authorization/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const countryFilter = getCountryFilter(session)

    const where: any = { ...countryFilter }
    if (status && status !== 'ALL') {
      where.status = status
    }
    if (from || to) {
      where.weekStart = {}
      if (from) where.weekStart.gte = new Date(from)
      if (to) where.weekStart.lte = new Date(to)
    }

    const settlements = await prisma.weeklySettlement.findMany({
      where,
      orderBy: { weekStart: 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.weeklySettlement.count({ where })

    const providerIds = [...new Set(settlements.map(s => s.providerId))]
    const users = await prisma.user.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true, email: true, mxId: true }
    })
    const userMap = new Map(users.map(u => [u.id, u]))

    const enrichedSettlements = settlements.map(s => ({
      ...s,
      provider: userMap.get(s.providerId) || null
    }))

    const allStats = await prisma.weeklySettlement.aggregate({
      _sum: { commissionOwed: true, totalEarnings: true },
      _count: true
    })

    const paidStats = await prisma.weeklySettlement.aggregate({
      where: { status: 'PAID' },
      _sum: { commissionOwed: true, totalEarnings: true },
      _count: true
    })

    const pendingStats = await prisma.weeklySettlement.aggregate({
      where: { status: 'PENDING' },
      _sum: { commissionOwed: true, totalEarnings: true },
      _count: true
    })

    const overdueStats = await prisma.weeklySettlement.aggregate({
      where: { status: 'OVERDUE' },
      _sum: { commissionOwed: true },
      _count: true
    })

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const pendingThisWeek = await prisma.weeklySettlement.aggregate({
      where: { status: 'PENDING', weekStart: { gte: weekAgo } },
      _sum: { commissionOwed: true },
      _count: true
    })

    return NextResponse.json({
      settlements: enrichedSettlements,
      summary: {
        totalCommissionOwed: allStats._sum.commissionOwed || 0,
        totalCommissionPaid: paidStats._sum.commissionOwed || 0,
        pendingThisWeek: pendingThisWeek._sum.commissionOwed || 0,
        overdueCount: overdueStats._count,
        pendingCount: pendingStats._count,
        paidCount: paidStats._count
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
    return NextResponse.json({ error: 'Failed to fetch commission data' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

    const settlement = await prisma.weeklySettlement.findUnique({
      where: { id: settlementId }
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
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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
      case 'SEND_REMINDER':
        return NextResponse.json({ message: 'Reminder sent', settlement })
      case 'SUSPEND':
        updateData = {
          status: 'SUSPENDED',
          suspendedAt: new Date()
        }
        await prisma.user.update({
          where: { id: settlement.providerId },
          data: {
            isSuspended: true,
            suspensionReason: 'Weekly commission not paid',
            suspendedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        })
        break
      case 'UNSUSPEND':
        updateData = {
          status: 'PAID',
          commissionPaid: true,
          paidAt: new Date()
        }
        await prisma.user.update({
          where: { id: settlement.providerId },
          data: {
            isSuspended: false,
            suspensionReason: null,
            suspendedUntil: null
          }
        })
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await prisma.weeklySettlement.update({
      where: { id: settlementId },
      data: updateData
    })

    return NextResponse.json({ settlement: updated })
  } catch (error) {
    console.error('Commission PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 })
  }
}
