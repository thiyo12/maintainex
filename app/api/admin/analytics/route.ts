import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { getCountryFilter } from '@/lib/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const countryFilter = getCountryFilter(session)
    const userCountryFilter = session.role === 'SUPER_ADMIN' ? {} : countryFilter
    const jobCountryFilter = session.role === 'SUPER_ADMIN' ? {} : countryFilter

    const [
      totalUsers,
      activeTaskers,
      activeCompanies,
      totalJobs,
      openJobs,
      completedJobs,
      cancelledJobs,
      commissionData,
      usersByCountry,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true, ...userCountryFilter } }),
      prisma.taskerProfile.count({ where: { isVerified: true, ...userCountryFilter } }),
      prisma.companyProfile.count({ where: userCountryFilter }),
      prisma.marketplaceJob.count({ where: jobCountryFilter }),
      prisma.marketplaceJob.count({ where: { status: 'OPEN', ...jobCountryFilter } }),
      prisma.marketplaceJob.count({ where: { status: 'COMPLETED', ...jobCountryFilter } }),
      prisma.marketplaceJob.count({ where: { status: 'CANCELLED', ...jobCountryFilter } }),
      prisma.commissionSettlement.aggregate({
        _sum: { commissionAmount: true, jobAmount: true },
        _count: true,
        where: jobCountryFilter,
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
        where: userCountryFilter,
      }),
      prisma.activityLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          adminEmail: true,
          action: true,
          entityType: true,
          entityId: true,
          description: true,
          createdAt: true,
        },
      }),
    ])

    const totalRevenue = Number(commissionData._sum.jobAmount || 0) / 100
    const totalCommission = Number(commissionData._sum.commissionAmount || 0) / 100

    const monthlyRevenue = await prisma.commissionSettlement.groupBy({
      by: ['status'],
      where: { status: 'SETTLED', ...jobCountryFilter },
      _sum: { commissionAmount: true },
    })

    const monthlyData: Record<string, number> = {}
    for (const item of monthlyRevenue) {
      monthlyData[item.status] = Number(item._sum.commissionAmount || 0) / 100
    }

    return NextResponse.json({
      summary: {
        totalUsers,
        activeTaskers,
        activeCompanies,
        totalJobs,
        openJobs,
        completedJobs,
        cancelledJobs,
        totalRevenue,
        totalCommission,
        commissionCount: commissionData._count,
      },
      jobsByStatus: {
        open: openJobs,
        completed: completedJobs,
        cancelled: cancelledJobs,
        inProgress: totalJobs - openJobs - completedJobs - cancelledJobs,
      },
      usersByRole: usersByCountry.reduce((acc: Record<string, number>, item) => {
        acc[item.role] = item._count
        return acc
      }, {}),
      recentActivity,
    })
  } catch (error) {
    console.error('Analytics GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
