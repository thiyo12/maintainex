import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/settings'
import { createNotification } from '@/lib/notifications'
import { completeAndReleaseEscrow } from '@/lib/finance/escrow/escrow-service'

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

    const protectedEscrows = await prisma.jobEscrow.findMany({
      where: { status: 'PROTECTED', paymentMethod: { not: 'CASH' } },
      select: { id: true, jobId: true, customerId: true },
    })

    const candidateJobIds = protectedEscrows.map(e => e.jobId)
    if (candidateJobIds.length === 0) {
      return NextResponse.json({ success: true, processed: 0 })
    }

    const inProgressJobs = await prisma.marketplaceJob.findMany({
      where: { id: { in: candidateJobIds }, status: 'IN_PROGRESS' },
      select: { id: true },
    })
    const inProgressSet = new Set(inProgressJobs.map(j => j.id))

    const workspaces = await prisma.jobWorkspace.findMany({
      where: {
        jobId: { in: candidateJobIds },
        progressStatus: 'COMPLETION_REQUESTED',
        completionRequestedAt: { not: null },
      },
      select: { jobId: true, completionRequestedAt: true },
    })
    const workspaceMap = new Map(workspaces.map(w => [w.jobId, w]))

    const eligibleEscrows = protectedEscrows.filter(e =>
      inProgressSet.has(e.jobId) && workspaceMap.has(e.jobId)
    )

    let processed = 0

    for (const escrow of eligibleEscrows) {
      const workspace = workspaceMap.get(escrow.jobId)!
      const hoursSinceRequest = (Date.now() - workspace.completionRequestedAt!.getTime()) / (1000 * 60 * 60)
      const hoursUntilRelease = autoReleaseHours - hoursSinceRequest

      if (hoursUntilRelease > 0) {
        for (const hrs of reminderHours) {
          if (hoursUntilRelease <= hrs && hoursUntilRelease > hrs - 1) {
            await createNotification({
              userId: escrow.customerId,
              title: 'Confirm job completion',
              body: `Payment auto-releases in ${Math.round(hoursUntilRelease)} hours. Tap to confirm or dispute.`,
              referenceType: 'ESCROW_REMINDER',
              referenceId: escrow.jobId,
            })
          }
        }
        continue
      }

      try {
        const result = await completeAndReleaseEscrow(
          { jobId: escrow.jobId, actorId: 'system:escrow-auto-release', actorType: 'SYSTEM' },
          escrow.jobId,
          { releaseMode: 'AUTO_RELEASE', autoReleaseHours }
        )

        const job = await prisma.marketplaceJob.findUnique({
          where: { id: escrow.jobId },
          select: { title: true },
        })

        await createNotification({
          userId: result.providerId,
          title: 'Payment Released',
          body: `Payment for "${job?.title ?? 'the job'}" has been released to your wallet.`,
          referenceType: 'PAYMENT_RELEASED',
          referenceId: escrow.jobId,
        })
        await createNotification({
          userId: escrow.customerId,
          title: 'Payment auto-released',
          body: 'The held payment was automatically released to the provider.',
          referenceType: 'PAYMENT_AUTO_RELEASED',
          referenceId: escrow.jobId,
        })
        processed++
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

    return NextResponse.json({ success: true, processed })
  } catch (error) {
    console.error('[CRON] Escrow auto-release error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
