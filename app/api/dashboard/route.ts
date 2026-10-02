import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryCodes, getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'
import { evaluateEffectivePermission, getPermissionCatalogEntry } from '@/lib/crm/governance'

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
    const can = (permission: string) => {
      const entry = getPermissionCatalogEntry(permission)
      return evaluateEffectivePermission({
        role: security.role,
        permission,
        permissionClass: entry?.class,
        overrides: security.permissionOverrides,
      }).allowed
    }

    const canUsers = can('users:view') || can('customers:view')
    const canTaskers = can('taskers:view')
    const canCompanies = can('companies:view')
    const canKyc = can('kyc:view') || can('kyc:review')
    const canJobs = can('jobs:view')
    const canFinance =
      can('commission:view') ||
      can('wallets:view') ||
      can('finance:payments:view')
    const canCheating = can('cheating:view') || can('risk:view')

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
    const scopedCountryCodes = getCrmCountryCodes(security)
    const classicJobWhere: any =
      scopedCountryCodes === null
        ? {}
        : scopedCountryCodes.length === 0
          ? { id: '__NONE__' }
          : { customer: { countryCode: { in: scopedCountryCodes } } }
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
      commissionByCurrency,
      pendingCheatingReports,
      classicTotal,
      classicOpen,
      classicCompleted,
      marketplaceTotal,
      marketplaceOpen,
      marketplaceCompleted,
      totalWalletBalance,
      walletByCurrency,
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
      prisma.weeklySettlement.groupBy({
        by: ['currency', 'status'],
        where: settlementWhere,
        _sum: { commissionOwed: true },
        _count: { _all: true },
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
      prisma.providerWallet.groupBy({
        by: ['currency'],
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

    const commissionCurrencyMap = new Map<string, {
      pendingCommission: number
      paidCommission: number
    }>()

    for (const row of commissionByCurrency) {
      const current = commissionCurrencyMap.get(row.currency) || {
        pendingCommission: 0,
        paidCommission: 0,
      }
      if (row.status === 'PAID') {
        current.paidCommission += Number(row._sum.commissionOwed || 0)
      } else if (row.status === 'PENDING' || row.status === 'OVERDUE' || row.status === 'SUSPENDED') {
        current.pendingCommission += Number(row._sum.commissionOwed || 0)
      }
      commissionCurrencyMap.set(row.currency, current)
    }

    const walletCurrencyMap = new Map(
      walletByCurrency.map(row => [
        row.currency,
        Number(row._sum.availableBalance || 0),
      ])
    )

    const financeCurrencies = [...new Set([
      ...commissionCurrencyMap.keys(),
      ...walletCurrencyMap.keys(),
    ])].sort()

    const financeByCurrency = financeCurrencies.map(currency => ({
      currency,
      pendingCommission: commissionCurrencyMap.get(currency)?.pendingCommission || 0,
      paidCommission: commissionCurrencyMap.get(currency)?.paidCommission || 0,
      providerWalletBalance: walletCurrencyMap.get(currency) || 0,
    }))

    return NextResponse.json(
      {
        stats: {
          totalUsers: canUsers ? totalUsers : 0,
          totalTaskers: canTaskers ? totalTaskers : 0,
          totalCompanies: canCompanies ? totalCompanies : 0,
          pendingKYC: canKyc ? pendingKYC : 0,
          verifiedKYC: canKyc ? verifiedKYC : 0,
          rejectedKYC: canKyc ? rejectedKYC : 0,
          bannedUsers: canUsers ? bannedUsers : 0,
          pendingSettlements: canFinance ? pendingSettlements : 0,
          overdueSettlements: canFinance ? overdueSettlements : 0,
          totalCommissionOwed: canFinance ? totalCommissionOwed._sum.commissionOwed || 0 : 0,
          totalCommissionPaid: canFinance ? totalCommissionPaid._sum.commissionOwed || 0 : 0,
          pendingCheatingReports: canCheating ? pendingCheatingReports : 0,
          totalJobPostings: canJobs ? classicTotal + marketplaceTotal : 0,
          openJobs: canJobs ? classicOpen + marketplaceOpen : 0,
          completedJobs: canJobs ? classicCompleted + marketplaceCompleted : 0,
          totalWalletBalance: canFinance ? totalWalletBalance._sum.availableBalance || 0 : 0,
          commissionRate: canFinance && Number.isFinite(commissionRate) ? commissionRate : 0,
        },
        financeByCurrency: canFinance ? financeByCurrency : [],
        weeklySummary: canFinance
          ? {
              pendingCommission: weeklySettlementsPending._sum.commissionOwed || 0,
              pendingCount: weeklySettlementsPending._count,
              overdueCommission: weeklySettlementsOverdue._sum.commissionOwed || 0,
              overdueCount: weeklySettlementsOverdue._count,
            }
          : {
              pendingCommission: 0,
              pendingCount: 0,
              overdueCommission: 0,
              overdueCount: 0,
            },
        isSuperAdmin: security.isSuperAdmin,
        capabilities: {
          jobs: canJobs,
          users: canUsers,
          taskers: canTaskers,
          companies: canCompanies,
          people: canUsers || canTaskers || canCompanies,
          kyc: canKyc,
          finance: canFinance,
          trust: canCheating,
          platform: can('settings:view') || can('market_config:read') || can('markets:view'),
        },
        scope: {
          countries: security.isSuperAdmin ? [] : security.assignedCountries,
          classicJobs: canJobs ? classicTotal : 0,
          marketplaceJobs: canJobs ? marketplaceTotal : 0,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
