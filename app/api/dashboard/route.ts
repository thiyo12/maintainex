import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'dashboard:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context
    const countryFilter = getCrmCountryFilter(security)

    const scopedUserIds = security.isSuperAdmin
      ? null
      : (await prisma.user.findMany({
          where: countryFilter,
          select: { id: true },
        })).map(user => user.id)

    const userWhere: any = { ...countryFilter }
    const taskerWhere: any = { ...countryFilter }
    const companyWhere: any = { ...countryFilter }
    const documentWhere: any = { ...countryFilter }
    const settlementWhere: any = { ...countryFilter }
    const marketplaceWhere: any = { ...countryFilter }
    const classicJobWhere: any = security.isSuperAdmin
      ? {}
      : { customer: { countryCode: { in: security.assignedCountries } } }
    const walletWhere: any = scopedUserIds ? { userId: { in: scopedUserIds } } : {}

    const [
      totalUsers,
      totalTaskers,
      totalCompanies,
      pendingKYC,
      verifiedKYC,
      rejectedKYC,
      bannedUsers,
      pendingSettlements,
      overdueSettlements,
      totalCommissionOwed,
      totalCommissionPaid,
      pendingCheatingReports,
      classicTotal,
      classicOpen,
      classicCompleted,
      marketplaceTotal,
      marketplaceOpen,
      marketplaceCompleted,
      totalWalletBalance,
      weeklySettlementsPending,
      weeklySettlementsOverdue,
      commissionSetting,
    ] = await Promise.all([
      prisma.user.count({ where: { ...userWhere, isBanned: false } }),
      prisma.taskerProfile.count({ where: taskerWhere }),
      prisma.companyProfile.count({ where: companyWhere }),
      prisma.identityDocument.count({ where: { ...documentWhere, status: 'PENDING' } }),
      prisma.identityDocument.count({ where: { ...documentWhere, status: 'APPROVED' } }),
      prisma.identityDocument.count({ where: { ...documentWhere, status: 'REJECTED' } }),
      prisma.user.count({ where: { ...userWhere, isBanned: true } }),
      prisma.weeklySettlement.count({ where: { ...settlementWhere, status: 'PENDING' } }),
      prisma.weeklySettlement.count({ where: { ...settlementWhere, status: 'OVERDUE' } }),
      prisma.weeklySettlement.aggregate({
        where: { ...settlementWhere, status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { commissionOwed: true },
      }),
      prisma.weeklySettlement.aggregate({
        where: { ...settlementWhere, status: 'PAID' },
        _sum: { commissionOwed: true },
      }),
      prisma.offPlatformDeal.count({
        where: { ...countryFilter, status: 'PENDING' },
      }),
      prisma.jobPosting.count({ where: classicJobWhere }),
      prisma.jobPosting.count({ where: { ...classicJobWhere, status: 'OPEN' } }),
      prisma.jobPosting.count({ where: { ...classicJobWhere, status: 'COMPLETED' } }),
      prisma.marketplaceJob.count({ where: marketplaceWhere }),
      prisma.marketplaceJob.count({ where: { ...marketplaceWhere, status: 'OPEN' } }),
      prisma.marketplaceJob.count({ where: { ...marketplaceWhere, status: 'COMPLETED' } }),
      prisma.providerWallet.aggregate({
        where: walletWhere,
        _sum: { availableBalance: true },
      }),
      prisma.weeklySettlement.aggregate({
        where: { ...settlementWhere, status: 'PENDING' },
        _sum: { commissionOwed: true },
        _count: true,
      }),
      prisma.weeklySettlement.aggregate({
        where: { ...settlementWhere, status: 'OVERDUE' },
        _sum: { commissionOwed: true },
        _count: true,
      }),
      prisma.settings.findUnique({
        where: { key: 'commissionRate' },
        select: { value: true },
      }),
    ])

    const commissionRate = Number(commissionSetting?.value ?? 10)

    return NextResponse.json(
      {
        stats: {
          totalUsers,
          totalTaskers,
          totalCompanies,
          pendingKYC,
          verifiedKYC,
          rejectedKYC,
          bannedUsers,
          pendingSettlements,
          overdueSettlements,
          totalCommissionOwed: totalCommissionOwed._sum.commissionOwed || 0,
          totalCommissionPaid: totalCommissionPaid._sum.commissionOwed || 0,
          pendingCheatingReports,
          totalJobPostings: classicTotal + marketplaceTotal,
          openJobs: classicOpen + marketplaceOpen,
          completedJobs: classicCompleted + marketplaceCompleted,
          totalWalletBalance: totalWalletBalance._sum.availableBalance || 0,
          commissionRate: Number.isFinite(commissionRate) ? commissionRate : 10,
        },
        weeklySummary: {
          pendingCommission: weeklySettlementsPending._sum.commissionOwed || 0,
          pendingCount: weeklySettlementsPending._count,
          overdueCommission: weeklySettlementsOverdue._sum.commissionOwed || 0,
          overdueCount: weeklySettlementsOverdue._count,
        },
        isSuperAdmin: security.isSuperAdmin,
        scope: {
          countries: security.isSuperAdmin ? [] : security.assignedCountries,
          classicJobs: classicTotal,
          marketplaceJobs: marketplaceTotal,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
