import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { getActivityLogs, getStatsForPeriod } from '@/lib/activity-log'
import { prisma } from '@/lib/prisma'

function getDateRange(period: string): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  
  switch (period) {
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'month':
      start.setMonth(start.getMonth() - 1)
      break
    case 'year':
      start.setFullYear(start.getFullYear() - 1)
      break
    default:
      start.setMonth(start.getMonth() - 1)
  }
  
  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const userBranchId = session.branchId

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'month'
    const entityType = searchParams.get('entityType') || undefined
    const adminId = searchParams.get('adminId') || undefined
    const filterBranchId = searchParams.get('branchId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const { start, end } = getDateRange(period)

    let branchId = undefined
    if (!isSuper && userBranchId) {
      branchId = userBranchId
    } else if (filterBranchId) {
      branchId = filterBranchId
    }

    const [currentPeriodStats, previousPeriodStats, recentActivity, activityTotal] = await Promise.all([
      getStatsForPeriod(start, end, branchId),
      getStatsForPeriod(
        new Date(start.getTime() - (end.getTime() - start.getTime())),
        new Date(start.getTime() - 1),
        branchId
      ),
      getActivityLogs({
        adminId,
        entityType,
        branchId,
        startDate: start,
        endDate: end,
        limit,
        offset: (page - 1) * limit
      }),
      getActivityLogs({
        adminId,
        entityType,
        branchId,
        startDate: start,
        endDate: end,
        limit: 10000
      })
    ])

    const getChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const summary = {
      bookings: {
        ...currentPeriodStats.bookings,
        change: getChange(currentPeriodStats.bookings.total, previousPeriodStats.bookings.total)
      },
      applications: {
        ...currentPeriodStats.applications,
        change: getChange(currentPeriodStats.applications.total, previousPeriodStats.applications.total)
      },
      adminActivity: {
        ...currentPeriodStats.adminActivity,
        change: getChange(currentPeriodStats.adminActivity.total, previousPeriodStats.adminActivity.total)
      }
    }

    const adminList = await prisma.activityLog.groupBy({
      by: ['adminId', 'adminEmail', 'adminName'],
      where: {
        createdAt: { gte: start, lte: end },
        ...(branchId ? { branchId } : {})
      },
      _count: true,
      orderBy: { _count: { createdAt: 'desc' } }
    })

    const branches = isSuper ? await prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, location: true }
    }) : []

    const dailyStats = await getDailyStats(start, end, branchId)

    return NextResponse.json({
      period,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      summary,
      dailyStats,
      recentActivity: recentActivity.logs,
      activityTotal: activityTotal.total,
      adminList: adminList.map(a => ({
        adminId: a.adminId,
        adminEmail: a.adminEmail,
        adminName: a.adminName,
        activityCount: a._count
      })),
      branches,
      currentBranch: userBranchId,
      isSuperAdmin: isSuper,
      pagination: {
        page,
        limit,
        total: activityTotal.total,
        totalPages: Math.ceil(activityTotal.total / limit)
      }
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getDailyStats(start: Date, end: Date, branchId?: string | null) {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  const whereClause = {
    createdAt: { gte: start, lte: end },
    ...(branchId ? { branchId } : {})
  }

  const bookings = await prisma.booking.groupBy({
    by: ['status'],
    _count: true,
    where: whereClause
  })

  const applications = await prisma.application.groupBy({
    by: ['status'],
    _count: true,
    where: whereClause
  })

  return {
    totalDays: days,
    bookingsByStatus: bookings,
    applicationsByStatus: applications
  }
}
