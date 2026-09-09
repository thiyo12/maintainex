import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/settings'
import { createNotification } from '@/lib/notifications'
import { releaseEscrow } from '@/lib/domain/job-lifecycle'

export const dynamic = 'force-dynamic'

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
        const hoursSinceHold = (Date.now() - hold.heldAt.getTime()) / (1000 * 60 * 60)
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

    const overdue = await prisma.jobEscrow.findMany({
      where: { status: 'ON_HOLD', heldAt: { not: null } },
      select: { id: true, jobId: true, customerId: true, heldAt: true },
    })

    let released = 0
    for (const hold of overdue) {
      if (!hold.heldAt) continue
      const hoursSinceHold = (Date.now() - hold.heldAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceHold < autoReleaseHours) continue

      try {
        const result = await releaseEscrow({
          jobId: hold.jobId,
          actorId: 'system:escrow-auto-release',
          actorType: 'STAFF',
        }, hold.jobId)
        const job = await prisma.marketplaceJob.findUnique({
          where: { id: hold.jobId },
          select: { title: true },
        })

        await createNotification({
          userId: result.providerId,
          title: 'Payment Released',
          body: `Payment for "${job?.title ?? 'the job'}" has been released to your wallet.`,
          referenceType: 'PAYMENT_RELEASED',
          referenceId: hold.jobId,
        })
        await createNotification({
          userId: hold.customerId,
          title: 'Payment auto-released',
          body: 'The held payment was automatically released to the provider.',
          referenceType: 'PAYMENT_AUTO_RELEASED',
          referenceId: hold.jobId,
        })
        released++
      } catch (error: any) {
        // A concurrent customer/admin release is a normal race: canonical
        // releaseEscrow() owns the state claim and prevents double credit.
        if (!String(error?.message || '').includes('No releasable escrow') &&
            !String(error?.message || '').includes('state changed')) {
          throw error
        }
      }
    }

    return NextResponse.json({ success: true, released })
  } catch (error) {
    console.error('[CRON] Escrow auto-release error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}