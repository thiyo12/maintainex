import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/settings'
import { createNotification } from '@/lib/notifications'
import { completeAndReleaseEscrow } from '@/lib/domain/job-lifecycle'

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

    const overdueEscrows = await prisma.jobEscrow.findMany({
      where: {
        status: 'ON_HOLD',
        heldAt: { not: null },
      },
      select: { id: true, jobId: true, customerId: true, heldAt: true },
    })

    for (const hold of overdueEscrows) {
      if (!hold.heldAt) continue

      const workspace = await prisma.jobWorkspace.findUnique({
        where: { jobId: hold.jobId },
        select: { progressStatus: true, completionRequestedAt: true },
      })
      if (!workspace || workspace.progressStatus === 'DISPUTED') continue
      if (workspace.progressStatus !== 'COMPLETION_REQUESTED' || !workspace.completionRequestedAt) continue

      const hoursSinceRequest = (Date.now() - workspace.completionRequestedAt.getTime()) / (1000 * 60 * 60)
      const hoursUntilRelease = autoReleaseHours - hoursSinceRequest

      if (hoursUntilRelease > 0) {
        for (const hrs of reminderHours) {
          if (hoursUntilRelease <= hrs && hoursUntilRelease > hrs - 1) {
            await createNotification({
              userId: hold.customerId,
              title: 'Confirm job completion',
              body: `Payment auto-releases in ${Math.round(hoursUntilRelease)} hours. Tap to confirm or dispute.`,
              referenceType: 'ESCROW_REMINDER',
              referenceId: hold.jobId,
            })
          }
        }
        continue
      }

      try {
        const result = await completeAndReleaseEscrow(
          { jobId: hold.jobId, actorId: 'system:escrow-auto-release', actorType: 'SYSTEM' },
          hold.jobId,
          { releaseMode: 'AUTO_RELEASE' }
        )

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
      } catch (error: any) {
        if (!String(error?.message || '').includes('No releasable escrow') &&
            !String(error?.message || '').includes('state changed') &&
            !String(error?.message || '').includes('Disputed jobs cannot') &&
            !String(error?.message || '').includes('Auto-release deadline') &&
            !String(error?.message || '').includes('Job not awaiting')) {
          throw error
        }
      }
    }

    return NextResponse.json({ success: true, processed: overdueEscrows.length })
  } catch (error) {
    console.error('[CRON] Escrow auto-release error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
