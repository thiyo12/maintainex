import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyEscrowTimeout } from '@/lib/notifications'
import { sendExpoPush } from '@/lib/push'
import { expirePendingEscrow } from '@/lib/finance/escrow/escrow-service'
import { markFailed } from '@/lib/finance/payouts/payout-engine'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Advance unpaid weekly commission debt into OVERDUE. Suspension remains a
    // deliberate finance/admin action, but overdue state must not depend on a
    // CRM page being opened.
    const overdueSettlements = await prisma.weeklySettlement.updateMany({
      where: {
        commissionPaid: false,
        status: 'PENDING',
        dueAt: { lt: now },
      },
      data: { status: 'OVERDUE' },
    })

    // Lift ordinary timed suspensions only. Commission-debt suspensions must
    // remain in force until finance explicitly records payment or deliberately
    // reactivates the provider while keeping the debt.
    const suspendedUsers = await prisma.user.findMany({
      where: {
        isSuspended: true,
        suspendedUntil: { lte: now },
        OR: [
          { suspensionReason: null },
          { suspensionReason: { not: 'Weekly commission not paid' } },
        ],
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

      notifyEscrowTimeout(escrow.jobId, escrow.providerId)
      const provider = await prisma.user.findUnique({
        where: { id: escrow.providerId },
        select: { pushToken: true },
      })
      if (provider?.pushToken) {
        void sendExpoPush(
          provider.pushToken,
          'Job Available Again',
          'Customer did not fund escrow — job is available again',
          { screen: '/(tasker)/jobs', id: escrow.jobId }
        )
      }
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

    return NextResponse.json({
      success: true,
      weeklySettlementsMarkedOverdue: overdueSettlements.count,
      suspensionsLifted: suspendedUsers.length,
      escrowTimeouts,
      payoutsProcessing: 0,
      payoutsFailed,
      pendingPayouts: pendingPayoutCount,
    })
  } catch (error) {
    console.error('[CRON] Daily maintenance error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
