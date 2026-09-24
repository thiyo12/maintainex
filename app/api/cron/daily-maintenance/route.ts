import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyEscrowTimeout } from '@/lib/notifications'
import { expirePendingEscrow } from '@/lib/domain/job-lifecycle'
import { markFailed } from '@/lib/payout-engine'
import { reconcilePreviousWeekCommissions } from '@/lib/commission-weekly'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Lift expired suspensions
    const suspendedUsers = await prisma.user.findMany({
      where: {
        isSuspended: true,
        suspendedUntil: { lte: new Date() },
      },
    })

    for (const user of suspendedUsers) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isSuspended: false, suspendedUntil: null },
      })
    }

    // 24h escrow funding timeout: QUOTE_ACCEPTED jobs with unfunded escrow revert to OPEN
    const fundingCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const staleEscrows = await prisma.jobEscrow.findMany({
      where: { status: 'PENDING_PAYMENT', createdAt: { lte: fundingCutoff } },
    })

    let escrowTimeouts = 0
    for (const escrow of staleEscrows) {
      const { reverted } = await expirePendingEscrow(escrow.id, { actorId: 'system' })
      if (!reverted) continue

      const quote = await prisma.jobQuote.findUnique({
        where: { id: escrow.quoteId },
        select: { providerId: true, providerType: true },
      })
      let notificationUserId = quote?.providerId || escrow.providerId
      if (quote?.providerType === 'COMPANY') {
        const company = await prisma.companyProfile.findUnique({
          where: { id: quote.providerId },
          select: { userId: true },
        })
        if (company) notificationUserId = company.userId
      }
      await notifyEscrowTimeout(escrow.jobId, notificationUserId)
      escrowTimeouts++
    }

    // Reconcile manual payouts: fails payouts stuck in PROCESSING for >48h
    const processingCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const staleProcessing = await prisma.payout.findMany({
      where: {
        status: 'PROCESSING',
        createdAt: { lte: processingCutoff },
      },
    })

    let payoutsFailed = 0
    for (const payout of staleProcessing) {
      await markFailed(
        payout.id,
        'Auto-failed: payout stuck in processing for over 48 hours',
        `cron-daily-maintenance-fail:${payout.id}`,
        'system'
      )
      payoutsFailed++
    }

    const pendingPayoutCount = await prisma.payout.count({ where: { status: 'PENDING' } })

    // Monday UTC: aggregate the previous full week's commissions that were
    // already withheld at escrow release. This is reconciliation only.
    const weeklyCommission = new Date().getUTCDay() === 1
      ? await reconcilePreviousWeekCommissions()
      : null

    return NextResponse.json({
      success: true,
      suspensionsLifted: suspendedUsers.length,
      escrowTimeouts,
      payoutsProcessing: 0,
      payoutsFailed,
      pendingPayouts: pendingPayoutCount,
      weeklyCommission: weeklyCommission
        ? {
            providers: weeklyCommission.providers,
            settlements: weeklyCommission.settlements,
            weekStart: weeklyCommission.weekStart.toISOString(),
            weekEnd: weeklyCommission.weekEnd.toISOString(),
          }
        : null,
    })
  } catch (error) {
    console.error('[CRON] Daily maintenance error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
