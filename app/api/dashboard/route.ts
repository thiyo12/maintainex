import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryFilter, guardCrmRequest } from '@/lib/crm/security'
import { evaluateEffectivePermission, getPermissionCatalogEntry } from '@/lib/crm/governance'

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

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
    const canFinance = can('commission:view') || can('wallets:view') || can('finance:payments:view')
    const canTrust = can('cheating:view') || can('risk:view')
    const canDisputes = can('disputes:view')

    const scopedUserIds = security.isSuperAdmin
      ? null
      : (await prisma.user.findMany({ where: countryFilter, select: { id: true } })).map(user => user.id)

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
      classicDisputes,
      marketplaceDisputes,
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
      prisma.weeklySettlement.aggregate({ where: { ...settlementWhere, status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { commissionOwed: true } }),
      prisma.weeklySettlement.aggregate({ where: { ...settlementWhere, status: 'PAID' }, _sum: { commissionOwed: true } }),
      prisma.weeklySettlement.groupBy({
        by: ['currency', 'status'],
        where: settlementWhere,
        _sum: { commissionOwed: true },
        _count: { _all: true },
      }),
      prisma.offPlatformDeal.count({ where: { ...countryFilter, status: 'PENDING' } }),
      prisma.jobPosting.count({ where: classicJobWhere }),
      prisma.jobPosting.count({ where: { ...classicJobWhere, status: 'OPEN' } }),
      prisma.jobPosting.count({ where: { ...classicJobWhere, status: 'COMPLETED' } }),
      prisma.marketplaceJob.count({ where: marketplaceWhere }),
      prisma.marketplaceJob.count({ where: { ...marketplaceWhere, status: 'OPEN' } }),
      prisma.marketplaceJob.count({ where: { ...marketplaceWhere, status: 'COMPLETED' } }),
      prisma.providerWallet.aggregate({ where: walletWhere, _sum: { availableBalance: true } }),
      prisma.providerWallet.groupBy({ by: ['currency'], where: walletWhere, _sum: { availableBalance: true } }),
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
      prisma.settings.findUnique({ where: { key: 'commissionRate' }, select: { value: true } }),
      canDisputes ? prisma.dispute.count({ where: { ...countryFilter, status: { in: ['OPEN', 'UNDER_REVIEW'] } } }) : Promise.resolve(0),
      canDisputes ? prisma.marketplaceDispute.count({ where: { ...countryFilter, status: { in: ['OPEN', 'UNDER_REVIEW', 'RESOLVING'] } } }) : Promise.resolve(0),
    ])

    const commissionRate = Number(commissionSetting?.value ?? 10)

    const commissionCurrencyMap = new Map<string, { pendingCommission: number; paidCommission: number }>()
    for (const row of commissionByCurrency) {
      const current = commissionCurrencyMap.get(row.currency) || { pendingCommission: 0, paidCommission: 0 }
      if (row.status === 'PAID') current.paidCommission += Number(row._sum.commissionOwed || 0)
      else if (['PENDING', 'OVERDUE', 'SUSPENDED'].includes(row.status)) current.pendingCommission += Number(row._sum.commissionOwed || 0)
      commissionCurrencyMap.set(row.currency, current)
    }

    const walletCurrencyMap = new Map(walletByCurrency.map(row => [row.currency, Number(row._sum.availableBalance || 0)]))
    const financeCurrencies = [...new Set([...commissionCurrencyMap.keys(), ...walletCurrencyMap.keys()])].sort()
    const financeByCurrency = financeCurrencies.map(currency => ({
      currency,
      pendingCommission: commissionCurrencyMap.get(currency)?.pendingCommission || 0,
      paidCommission: commissionCurrencyMap.get(currency)?.paidCommission || 0,
      providerWalletBalance: walletCurrencyMap.get(currency) || 0,
    }))

    let recentJobs: Array<{
      id: string
      source: 'V1' | 'V2'
      title: string
      customer: string
      provider: string
      amount: number
      currency: string
      status: string
      createdAt: string
    }> = []
    let jobTrend: Array<{ date: string; jobsCreated: number }> = []

    if (canJobs) {
      const trendStart = new Date()
      trendStart.setUTCHours(0, 0, 0, 0)
      trendStart.setUTCDate(trendStart.getUTCDate() - 29)

      const [recentClassic, recentMarketplace, classicTrend, marketplaceTrend] = await Promise.all([
        prisma.jobPosting.findMany({
          where: classicJobWhere,
          orderBy: { createdAt: 'desc' },
          take: 7,
          select: {
            id: true,
            title: true,
            status: true,
            budget: true,
            createdAt: true,
            customer: { select: { name: true } },
            assignments: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { tasker: { select: { user: { select: { name: true } } } } },
            },
          },
        }),
        prisma.marketplaceJob.findMany({
          where: marketplaceWhere,
          orderBy: { createdAt: 'desc' },
          take: 7,
          select: {
            id: true,
            title: true,
            status: true,
            budgetAmount: true,
            customerId: true,
            countryCode: true,
            createdAt: true,
          },
        }),
        prisma.jobPosting.findMany({
          where: { ...classicJobWhere, createdAt: { gte: trendStart } },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        }),
        prisma.marketplaceJob.findMany({
          where: { ...marketplaceWhere, createdAt: { gte: trendStart } },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        }),
      ])

      const marketplaceIds = recentMarketplace.map(job => job.id)
      const customerIds = [...new Set(recentMarketplace.map(job => job.customerId))]
      const [marketplaceCustomers, marketplaceAssignments] = await Promise.all([
        customerIds.length
          ? prisma.user.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
          : Promise.resolve([]),
        marketplaceIds.length
          ? prisma.companyJobAssignment.findMany({
              where: { jobId: { in: marketplaceIds }, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] } },
              orderBy: { createdAt: 'desc' },
              select: {
                jobId: true,
                worker: { select: { name: true } },
                company: { select: { companyName: true } },
              },
            })
          : Promise.resolve([]),
      ])

      const customerMap = new Map(marketplaceCustomers.map(row => [row.id, row.name]))
      const assignmentMap = new Map<string, string>()
      for (const row of marketplaceAssignments) {
        if (!assignmentMap.has(row.jobId)) assignmentMap.set(row.jobId, row.worker?.name || row.company?.companyName || 'Assigned provider')
      }

      recentJobs = [
        ...recentClassic.map(job => ({
          id: job.id,
          source: 'V1' as const,
          title: job.title,
          customer: job.customer?.name || 'Customer',
          provider: job.assignments?.[0]?.tasker?.user?.name || 'Unassigned',
          amount: Number(job.budget || 0),
          currency: 'LKR',
          status: job.status,
          createdAt: job.createdAt.toISOString(),
        })),
        ...recentMarketplace.map(job => ({
          id: job.id,
          source: 'V2' as const,
          title: job.title,
          customer: customerMap.get(job.customerId) || 'Customer',
          provider: assignmentMap.get(job.id) || 'Marketplace provider',
          amount: Number(job.budgetAmount || 0),
          currency: job.countryCode === 'CA' ? 'CAD' : 'LKR',
          status: job.status,
          createdAt: job.createdAt.toISOString(),
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6)

      const counts = new Map<string, number>()
      for (let index = 0; index < 30; index += 1) {
        const date = new Date(trendStart)
        date.setUTCDate(trendStart.getUTCDate() + index)
        counts.set(dayKey(date), 0)
      }
      for (const row of [...classicTrend, ...marketplaceTrend]) {
        const key = dayKey(row.createdAt)
        if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1)
      }
      jobTrend = [...counts.entries()].map(([date, jobsCreated]) => ({ date, jobsCreated }))
    }

    return NextResponse.json({
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
        pendingCheatingReports: canTrust ? pendingCheatingReports : 0,
        openDisputes: canDisputes ? classicDisputes + marketplaceDisputes : 0,
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
        : { pendingCommission: 0, pendingCount: 0, overdueCommission: 0, overdueCount: 0 },
      recentJobs,
      jobTrend,
      isSuperAdmin: security.isSuperAdmin,
      capabilities: {
        jobs: canJobs,
        users: canUsers,
        taskers: canTaskers,
        companies: canCompanies,
        people: canUsers || canTaskers || canCompanies,
        kyc: canKyc,
        finance: canFinance,
        trust: canTrust,
        disputes: canDisputes,
        platform: can('settings:view') || can('market_config:read') || can('markets:view'),
        health: can('health:view'),
      },
      scope: {
        countries: security.isSuperAdmin ? [] : security.assignedCountries,
        classicJobs: canJobs ? classicTotal : 0,
        marketplaceJobs: canJobs ? marketplaceTotal : 0,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('CRM dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
