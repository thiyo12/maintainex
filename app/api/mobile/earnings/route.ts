import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { readCanonicalProviderBalance } from '@/lib/financial-read'
import { bigIntToSafeNumber, getCurrencyForCountry } from '@/lib/shared/money/money'
import { readProviderFinancialAccountForUser } from '@/lib/finance/commissions/provider-balance-service'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const countryCode = user.countryCode || 'LK'
    const currency = getCurrencyForCountry(countryCode)

    const [payouts, canonicalBalance, financialAccount] = await Promise.all([
      prisma.payout.findMany({
        where: { userId: user.id, countryCode, currency },
        orderBy: { createdAt: 'desc' },
      }),
      readCanonicalProviderBalance(user.id, currency),
      prisma.$transaction(tx =>
        readProviderFinancialAccountForUser(tx, {
          userId: user.id,
          providerType: 'TASKER',
          currency,
        })
      ),
    ])

    const walletId = canonicalBalance?.walletId ?? null
    const earnedAggregate = walletId
      ? await prisma.financialLedger.aggregate({
          where: {
            accountId: walletId,
            accountType: 'PROVIDER_WALLET',
            entryType: 'CREDIT',
            referenceType: 'ESCROW_RELEASE',
            currency,
          },
          _sum: { amount: true },
        })
      : null

    const totalEarnedMinor = earnedAggregate?._sum.amount ?? 0n
    const pendingPayoutMinor = payouts
      .filter(p => ['REQUESTED', 'RESERVED', 'PROCESSING', 'PENDING'].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0n)

    const v1CompletedJobs = await prisma.jobPosting.count({
      where: {
        status: 'COMPLETED',
        assignments: { some: { tasker: { userId: user.id } } },
      },
    })

    const v2CompletedRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT mj.id)::bigint AS count
      FROM "MarketplaceJob" mj
      JOIN "JobQuote" jq ON jq."jobId" = mj.id
      WHERE mj.status = 'COMPLETED'
        AND jq."providerType" = 'INDIVIDUAL'
        AND jq."providerId" = ${user.id}
        AND jq.status = 'ACCEPTED'
    `
    const completedJobs = v1CompletedJobs + Number(v2CompletedRows[0]?.count ?? 0n)

    const totalEarned = bigIntToSafeNumber(totalEarnedMinor) / 100
    const pendingAmount = bigIntToSafeNumber(pendingPayoutMinor) / 100
    const availableBalance = canonicalBalance
      ? bigIntToSafeNumber(canonicalBalance.availableBalance) / 100
      : 0
    const pendingBalance = canonicalBalance
      ? bigIntToSafeNumber(canonicalBalance.pendingBalance) / 100
      : 0

    const pendingCommissionPayments = await prisma.commissionPayment.findMany({
      where: {
        providerId: user.id,
        status: 'PENDING',
        countryCode,
        currency,
      },
      include: {
        weeklySettlement: {
          select: {
            weekStart: true,
            weekEnd: true,
            commissionOwed: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    const taskerIdentity = await prisma.providerIdentity.findFirst({
      where: {
        currentUserId: user.id,
        identityType: 'TASKER',
      },
      select: { id: true },
    })
    const recentCommissionRecoveries = taskerIdentity
      ? await prisma.providerCommissionRecovery.findMany({
          where: {
            providerIdentityId: taskerIdentity.id,
            currency,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            sourceJobId: true,
            sourceEscrowId: true,
            amount: true,
            currency: true,
            method: true,
            createdAt: true,
            receivable: {
              select: {
                jobId: true,
                escrowId: true,
              },
            },
          },
        })
      : []

    const recentBalanceAdjustmentRecoveries = taskerIdentity
      ? await prisma.providerBalanceAdjustmentRecovery.findMany({
          where: {
            providerIdentityId: taskerIdentity.id,
            currency,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            sourceJobId: true,
            sourceEscrowId: true,
            amount: true,
            currency: true,
            method: true,
            createdAt: true,
            adjustment: {
              select: {
                id: true,
                adjustmentType: true,
                jobId: true,
                sourceProvider: true,
                sourceReference: true,
              },
            },
          },
        })
      : []

    return NextResponse.json({
      countryCode,
      currency,
      totalEarned,
      pendingAmount,
      balance: availableBalance,
      availableBalance,
      pendingBalance,
      maintainexBalance: {
        commissionDueMinor: (financialAccount?.commissionDue ?? 0n).toString(),
        commissionDue: bigIntToSafeNumber(financialAccount?.commissionDue ?? 0n) / 100,
        adjustmentDueMinor: (financialAccount?.adjustmentDue ?? 0n).toString(),
        adjustmentDue: bigIntToSafeNumber(financialAccount?.adjustmentDue ?? 0n) / 100,
        totalLiabilityMinor: ((financialAccount?.commissionDue ?? 0n) + (financialAccount?.adjustmentDue ?? 0n)).toString(),
        totalLiability: bigIntToSafeNumber(
          (financialAccount?.commissionDue ?? 0n) + (financialAccount?.adjustmentDue ?? 0n)
        ) / 100,
        availableEarningsMinor: (canonicalBalance?.availableBalance ?? 0n).toString(),
        pendingEarningsMinor: (canonicalBalance?.pendingBalance ?? 0n).toString(),
        status: financialAccount?.status ?? 'CLEAR',
        cashJobsAllowed: financialAccount?.cashJobsAllowed ?? true,
        onlineJobsAllowed: financialAccount?.onlineJobsAllowed ?? true,
        manualReviewRequired: financialAccount?.manualReviewRequired ?? false,
        oldestCommissionDueAt: financialAccount?.oldestCommissionDueAt?.toISOString() ?? null,
        currency,
      },
      completedJobs,
      recentCommissionRecoveries: recentCommissionRecoveries.map(recovery => ({
        id: recovery.id,
        amountMinor: recovery.amount.toString(),
        amount: bigIntToSafeNumber(recovery.amount) / 100,
        currency: recovery.currency,
        method: recovery.method,
        sourceJobId: recovery.sourceJobId,
        sourceEscrowId: recovery.sourceEscrowId,
        originalCashJobId: recovery.receivable.jobId,
        createdAt: recovery.createdAt.toISOString(),
      })),
      recentBalanceAdjustmentRecoveries: recentBalanceAdjustmentRecoveries.map(recovery => ({
        id: recovery.id,
        amountMinor: recovery.amount.toString(),
        amount: bigIntToSafeNumber(recovery.amount) / 100,
        currency: recovery.currency,
        method: recovery.method,
        sourceJobId: recovery.sourceJobId,
        sourceEscrowId: recovery.sourceEscrowId,
        adjustmentId: recovery.adjustment.id,
        adjustmentType: recovery.adjustment.adjustmentType,
        originalJobId: recovery.adjustment.jobId,
        sourceProvider: recovery.adjustment.sourceProvider,
        sourceReference: recovery.adjustment.sourceReference,
        createdAt: recovery.createdAt.toISOString(),
      })),
      recentPayouts: payouts.slice(0, 20).map(p => ({
        id: p.id,
        amount: bigIntToSafeNumber(p.amount) / 100,
        currency: p.currency,
        description: p.description,
        status: p.status,
        source: p.source,
        createdAt: p.createdAt.toISOString(),
        clearedAt: p.clearedAt?.toISOString(),
      })),
      pendingCommissionPayments: pendingCommissionPayments.map(cp => ({
        id: cp.id,
        referenceNumber: cp.referenceNumber,
        amountDue: cp.amountDue,
        method: cp.method,
        weekStart: cp.weeklySettlement.weekStart.toISOString(),
        weekEnd: cp.weeklySettlement.weekEnd.toISOString(),
        dueAt: cp.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Earnings error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
