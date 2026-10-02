import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'
import { evaluateEffectivePermission } from '@/lib/crm/governance'
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

    const allowed = (permission: string) =>
      evaluateEffectivePermission({
        role: security.role,
        permission,
        overrides: security.permissionOverrides,
      }).allowed

    const canFinance = allowed('finance:payments:view')
    const canRealEstate = allowed('realestate:view')
    const canDisputes = allowed('disputes:view')

    const countryFilter = getCrmCountryFilter(security)
    const branchScopeResult = await resolveReportBranchScope(sessionFromGuard(security), null)
    if (!branchScopeResult.ok) {
      return NextResponse.json({ error: branchScopeResult.error }, { status: branchScopeResult.status })
    }
    const branchIds = branchScopeResult.scope.branchIds
    const activityWhere = branchIds === null ? {} : { branchId: { in: branchIds } }
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeTaskers,
      activeCompanies,
      totalJobs,
      openJobs,
      completedJobs,
      cancelledJobs,
      staleJobs,
      commissionData,
      usersByRole,
      recentActivity,
      openDisputes,
      realEstateTotal,
      realEstatePending,
      avgTaskerResponse,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true, ...countryFilter } }),
      prisma.taskerProfile.count({ where: { isVerified: true, ...countryFilter } }),
      prisma.companyProfile.count({ where: countryFilter }),
      prisma.marketplaceJob.count({ where: countryFilter }),
      prisma.marketplaceJob.count({ where: { status: 'OPEN', ...countryFilter } }),
      prisma.marketplaceJob.count({ where: { status: 'COMPLETED', ...countryFilter } }),
      prisma.marketplaceJob.count({ where: { status: 'CANCELLED', ...countryFilter } }),
      prisma.marketplaceJob.count({
        where: {
          ...countryFilter,
          status: { in: ['OPEN', 'QUOTE_ACCEPTED', 'IN_PROGRESS'] },
          updatedAt: { lt: staleCutoff },
        },
      }),
      canFinance
        ? prisma.commissionSettlement.aggregate({
            _sum: { commissionAmount: true, jobAmount: true },
            _count: true,
            where: countryFilter,
          })
        : Promise.resolve({ _sum: { commissionAmount: null, jobAmount: null }, _count: 0 }),
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
      canDisputes
        ? prisma.marketplaceDispute.count({
            where: {
              ...countryFilter,
              status: { in: ['OPEN', 'UNDER_REVIEW', 'RESOLVING'] },
            },
          })
        : Promise.resolve(0),
      canRealEstate
        ? prisma.realEstateListing.count({ where: countryFilter })
        : Promise.resolve(0),
      canRealEstate
        ? prisma.realEstateListing.count({ where: { ...countryFilter, status: 'pending' } })
        : Promise.resolve(0),
      prisma.taskerProfile.aggregate({
        where: { isVerified: true, ...countryFilter },
        _avg: { avgResponseMin: true },
      }),
    ])

    const totalRevenue = canFinance ? Number(commissionData._sum.jobAmount || 0) / 100 : null
    const totalCommission = canFinance ? Number(commissionData._sum.commissionAmount || 0) / 100 : null
    const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0

    return NextResponse.json(
      {
        visibility: {
          finance: canFinance,
          realEstate: canRealEstate,
          disputes: canDisputes,
        },
        summary: {
          totalUsers,
          activeTaskers,
          activeCompanies,
          totalJobs,
          openJobs,
          completedJobs,
          cancelledJobs,
          staleJobs,
          completionRate,
          openDisputes,
          realEstateTotal,
          realEstatePending,
          avgTaskerResponseMin: Math.round(Number(avgTaskerResponse._avg.avgResponseMin || 0)),
          totalRevenue,
          totalCommission,
          commissionCount: canFinance ? commissionData._count : null,
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
