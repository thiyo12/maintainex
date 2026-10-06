import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCrmCountryCodes, getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'
import { evaluateEffectivePermission } from '@/lib/crm/governance'

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
    const scopedCountryCodes = getCrmCountryCodes(security)
    const branchIds = scopedCountryCodes === null
      ? null
      : (await prisma.branch.findMany({
          where: { region: { in: scopedCountryCodes } },
          select: { id: true },
        })).map(branch => branch.id)
    const activityWhere = branchIds === null ? {} : { branchId: { in: branchIds } }
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const trendStart = new Date()
    trendStart.setUTCDate(trendStart.getUTCDate() - 29)
    trendStart.setUTCHours(0, 0, 0, 0)

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
    const trendCountryClause =
      scopedCountryCodes === null
        ? Prisma.empty
        : scopedCountryCodes.length === 0
          ? Prisma.sql`AND 1 = 0`
          : Prisma.sql`AND "countryCode" IN (${Prisma.join(scopedCountryCodes)})`

    type JobTrendRow = { day: Date; count: bigint }
    type RevenueTrendRow = { day: Date; amount: bigint }

    const [jobTrendRows, revenueTrendRows] = await Promise.all([
      prisma.$queryRaw<JobTrendRow[]>(Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "MarketplaceJob"
        WHERE "createdAt" >= ${trendStart}
        ${trendCountryClause}
        GROUP BY 1
        ORDER BY 1
      `),
      canFinance
        ? prisma.$queryRaw<RevenueTrendRow[]>(Prisma.sql`
            SELECT date_trunc('day', "createdAt") AS day,
                   COALESCE(SUM("commissionAmount"), 0)::bigint AS amount
            FROM "CommissionSettlement"
            WHERE "createdAt" >= ${trendStart}
            ${trendCountryClause}
            GROUP BY 1
            ORDER BY 1
          `)
        : Promise.resolve([] as RevenueTrendRow[]),
    ])

    const jobTrendMap = new Map(
      jobTrendRows.map(row => [new Date(row.day).toISOString().slice(0, 10), Number(row.count)])
    )
    const revenueTrendMap = new Map(
      revenueTrendRows.map(row => [new Date(row.day).toISOString().slice(0, 10), Number(row.amount) / 100])
    )

    const trend = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(trendStart)
      date.setUTCDate(trendStart.getUTCDate() + index)
      const key = date.toISOString().slice(0, 10)
      return {
        date: key,
        jobs: jobTrendMap.get(key) || 0,
        revenue: canFinance ? revenueTrendMap.get(key) || 0 : null,
      }
    })


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
        trend,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM analytics GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
