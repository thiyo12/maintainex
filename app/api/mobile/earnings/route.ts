import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { readCanonicalProviderBalance } from '@/lib/financial-read'
import { bigIntToSafeNumber } from '@/lib/shared/money/money'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [payouts, canonicalBalance] = await Promise.all([
      prisma.payout.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      readCanonicalProviderBalance(user.id, 'LKR'),
    ])

    const walletId = canonicalBalance?.walletId ?? null
    const earnedAggregate = walletId
      ? await prisma.financialLedger.aggregate({
          where: {
            accountId: walletId,
            accountType: 'PROVIDER_WALLET',
            entryType: 'CREDIT',
            referenceType: 'ESCROW_RELEASE',
            currency: 'LKR',
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

    const v2CompletedRows = await prisma.$queryRaw<Array<{ count: bigint }>>\`
      SELECT COUNT(DISTINCT mj.id)::bigint AS count
      FROM "MarketplaceJob" mj
      JOIN "JobQuote" jq ON jq."jobId" = mj.id
      WHERE mj.status = 'COMPLETED'
        AND jq."providerType" = 'INDIVIDUAL'
        AND jq."providerId" = ${user.id}
        AND jq.status = 'ACCEPTED'
    \`
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

    return NextResponse.json({
      totalEarned,
      pendingAmount,
      availableBalance,
      pendingBalance,
      completedJobs,
      recentPayouts: payouts.slice(0, 20).map(p => ({
        id: p.id,
        amount: Number(p.amount) / 100,
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
