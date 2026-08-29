import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/settings'
import { createNotification } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const autoReleaseHours = await getSetting('escrow.auto_release_hours', 48)
    const reminderHoursStr = await getSetting('escrow.reminder_hours', '36,24,12')
    const reminderHours = reminderHoursStr.split(',').map(Number)

    // Send reminders
    for (const hrs of reminderHours) {
      const dueSoon = await prisma.jobEscrow.findMany({
        where: {
          status: 'ON_HOLD',
          heldAt: { not: null },
          releasedAt: null,
          refundedAt: null,
        },
      })

      for (const hold of dueSoon) {
        if (!hold.heldAt) continue
        const hoursSinceHold = (Date.now() - new Date(hold.heldAt).getTime()) / (1000 * 60 * 60)
        const hoursUntilRelease = autoReleaseHours - hoursSinceHold

        if (hoursUntilRelease > 0 && hoursUntilRelease <= hrs && hoursUntilRelease > hrs - 1) {
          await createNotification({
            userId: hold.customerId,
            title: 'Confirm job completion',
            body: `Payment auto-releases in ${Math.round(hoursUntilRelease)} hours. Tap to confirm or dispute.`,
            referenceType: 'ESCROW_REMINDER',
            referenceId: hold.jobId,
          })
        }
      }
    }

    // Auto-release overdue escrows
    const overdue = await prisma.jobEscrow.findMany({
      where: {
        status: 'ON_HOLD',
        heldAt: { not: null },
      },
    })

    let released = 0
    for (const hold of overdue) {
      if (!hold.heldAt) continue
      const hoursSinceHold = (Date.now() - new Date(hold.heldAt).getTime()) / (1000 * 60 * 60)
      if (hoursSinceHold >= autoReleaseHours) {
        await prisma.jobEscrow.update({
          where: { id: hold.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        })
        await prisma.marketplaceJob.update({
          where: { id: hold.jobId },
          data: { status: 'COMPLETED' },
        })

        // Credit provider wallet
        const providerWallet = await prisma.providerWallet.findUnique({
          where: { userId: hold.providerId },
        })
        if (providerWallet) {
          const payout = Number(hold.amount) - Number(hold.serviceFee)
          await prisma.providerWallet.update({
            where: { userId: hold.providerId },
            data: { availableBalance: { increment: payout } },
          })
          await prisma.walletTransaction.create({
            data: {
              userId: hold.providerId,
              walletType: 'PROVIDER',
              type: 'CREDIT',
              amount: payout,
              balanceBefore: providerWallet.availableBalance,
              balanceAfter: providerWallet.availableBalance + payout,
              reference: `ESCROW_RELEASE_${hold.id}`,
              referenceType: 'ESCROW_RELEASE',
              referenceId: hold.id,
            },
          })
        }

        const job = await prisma.marketplaceJob.findUnique({
          where: { id: hold.jobId },
          select: { title: true },
        })

        await createNotification({
          userId: hold.providerId,
          title: 'Payment Released',
          body: `Payment for "${job?.title ?? 'the job'}" has been released to your wallet.`,
          referenceType: 'PAYMENT_RELEASED',
          referenceId: hold.jobId,
        })
        await createNotification({
          userId: hold.customerId,
          title: 'Payment auto-released',
          body: 'The held payment was automatically released to the tasker.',
          referenceType: 'PAYMENT_AUTO_RELEASED',
          referenceId: hold.jobId,
        })
        released++
      }
    }

    return NextResponse.json({ success: true, released })
  } catch (error) {
    console.error('[CRON] Escrow auto-release error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
