import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/authentication/auth-utils'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'

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
      totalJobPostings,
      openJobs,
      completedJobs,
      totalWalletBalance,
      weeklySettlementsPending,
      weeklySettlementsOverdue,
    ] = await Promise.all([
      prisma.user.count({ where: { isBanned: false } }),
      prisma.taskerProfile.count(),
      prisma.companyProfile.count(),
      prisma.identityDocument.count({ where: { status: 'PENDING' } }),
      prisma.identityDocument.count({ where: { status: 'APPROVED' } }),
      prisma.identityDocument.count({ where: { status: 'REJECTED' } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.weeklySettlement.count({ where: { status: 'PENDING' } }),
      prisma.weeklySettlement.count({ where: { status: 'OVERDUE' } }),
      prisma.weeklySettlement.aggregate({
        where: { status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { commissionOwed: true }
      }),
      prisma.weeklySettlement.aggregate({
        where: { status: 'PAID' },
        _sum: { commissionOwed: true }
      }),
      prisma.offPlatformDeal.count({ where: { status: 'PENDING' } }),
      prisma.jobPosting.count(),
      prisma.jobPosting.count({ where: { status: 'OPEN' } }),
      prisma.jobPosting.count({ where: { status: 'COMPLETED' } }),
      prisma.providerWallet.aggregate({ _sum: { availableBalance: true } }),
      prisma.weeklySettlement.aggregate({
        where: { status: 'PENDING' },
        _sum: { commissionOwed: true },
        _count: true
      }),
      prisma.weeklySettlement.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { commissionOwed: true },
        _count: true
      }),
    ])

    return NextResponse.json({
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
        totalJobPostings,
        openJobs,
        completedJobs,
        totalWalletBalance: totalWalletBalance._sum.availableBalance || 0,
        commissionRate: 10,
      },
      weeklySummary: {
        pendingCommission: weeklySettlementsPending._sum.commissionOwed || 0,
        pendingCount: weeklySettlementsPending._count,
        overdueCommission: weeklySettlementsOverdue._sum.commissionOwed || 0,
        overdueCount: weeklySettlementsOverdue._count,
      },
      isSuperAdmin: isSuper
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
