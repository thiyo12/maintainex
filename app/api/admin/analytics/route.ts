import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'
import type { AdminSession } from '@/lib/admin-types'

function sessionFromGuard(context: {
  adminId: string
  email: string
  role: AdminSession['role']
  assignedCountries: string[]
}): AdminSession {
  return {
    id: context.adminId,
    email: context.email,
    role: context.role,
    firstName: '',
    lastName: '',
    assignedCountries: context.assignedCountries,
    authType: 'adminUser',
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'analytics:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const countryFilter = getCrmCountryFilter(security)
    const branchScopeResult = await resolveReportBranchScope(sessionFromGuard(security), null)
    if (!branchScopeResult.ok) {
      return NextResponse.json({ error: branchScopeResult.error }, { status: branchScopeResult.status })
    }
    const branchIds = branchScopeResult.scope.branchIds
    const activityWhere = branchIds === null ? {} : { branchId: { in: branchIds } }

    const [
      totalUsers,
      activeTaskers,
      activeCompanies,
      totalJobs,
      openJobs,
      completedJobs,
      cancelledJobs,
      commissionData,
      usersByRole,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true, ...countryFilter } }),
      prisma.taskerProfile.count({ where: { isVerified: true, ...countryFilter } }),
      prisma.companyProfile.count({ where: countryFilter }),
      prisma.marketplaceJob.count({ where: countryFilter }),
      prisma.marketplaceJob.count({ where: { status: 'OPEN', ...countryFilter } }),
      prisma.marketplaceJob.count({ where: { status: 'COMPLETED', ...countryFilter } }),
      prisma.marketplaceJob.count({ where: { status: 'CANCELLED', ...countryFilter } }),
      prisma.commissionSettlement.aggregate({
        _sum: { commissionAmount: true, jobAmount: true },
        _count: true,
        where: countryFilter,
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
        where: countryFilter,
      }),
      prisma.activityLog.findMany({
        where: activityWhere,
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

    return NextResponse.json(
      {
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
          inProgress: Math.max(0, totalJobs - openJobs - completedJobs - cancelledJobs),
        },
        usersByRole: usersByRole.reduce((acc: Record<string, number>, item) => {
          acc[item.role] = item._count
          return acc
        }, {}),
        recentActivity,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM analytics GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
