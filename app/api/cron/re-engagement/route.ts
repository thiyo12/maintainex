import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/settings'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const hoursThreshold = await getSetting('notify.reengagement_hours', 24)
    const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000)

    const oldJobs = await prisma.marketplaceJob.findMany({
      where: {
        status: 'OPEN',
        createdAt: { lte: cutoff },
      },
    })

    const jobIds = oldJobs.map(j => j.id)
    const quoteCounts = await prisma.jobQuote.groupBy({
      by: ['jobId'],
      where: { jobId: { in: jobIds } },
      _count: true,
    })
    const quoteCountMap = new Map(quoteCounts.map(q => [q.jobId, q._count]))

    let notified = 0
    for (const job of oldJobs) {
      if ((quoteCountMap.get(job.id) || 0) === 0) {
        await createNotification({
          userId: job.customerId,
          title: 'No quotes yet on your job',
          body: `"${job.title}" has no quotes. Try our Offer Program for instant booking.`,
          referenceType: 'RE_ENGAGEMENT',
          referenceId: job.id,
        })
        notified++
      }
    }

    return NextResponse.json({ success: true, notified })
  } catch (error) {
    logger.error('Re-engagement cron failed unexpectedly', { err: error })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
