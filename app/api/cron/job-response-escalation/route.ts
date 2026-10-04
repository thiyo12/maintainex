import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { createWorkItem } from '@/lib/work-queue'
import { notifyJobEscalated } from '@/lib/notifications'
import { matchesBearerSecret } from '@/lib/security/secret-compare'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (!matchesBearerSecret(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const overdueJobs = await prisma.marketplaceJob.findMany({
      where: {
        status: 'OPEN',
        responseState: 'awaiting',
        responseDeadline: { lte: new Date() },
      },
    })

    let escalated = 0
    let respondedLate = 0

    for (const job of overdueJobs) {
      const quoteCount = await prisma.jobQuote.count({ where: { jobId: job.id } })
      if (quoteCount > 0) {
        await prisma.marketplaceJob.update({
          where: { id: job.id },
          data: { responseState: 'responded' },
        })
        respondedLate += 1
        continue
      }

      const existingAlert = await prisma.adminAlert.findFirst({
        where: {
          type: 'tasker_escalation',
          targetId: job.id,
          status: { in: ['open', 'in_progress'] },
        },
      })
      if (existingAlert) continue

      await prisma.marketplaceJob.update({
        where: { id: job.id },
        data: { responseState: 'escalated', escalatedAt: new Date() },
      })

      await createWorkItem({
        category: 'tasker_escalation',
        title: '⚠️ Tasker Required — No Response for 2 Hours',
        description: `No tasker responded to "${job.title}" (${job.id}) within the response window. Assign a tasker or follow up.`,
        severity: 'high',
        priority: 'high',
        targetTable: 'MarketplaceJob',
        targetId: job.id,
      })

      await notifyJobEscalated(job.id, job.customerId, job.title)
      escalated += 1
    }

    return NextResponse.json({ success: true, escalated, respondedLate, scanned: overdueJobs.length })
  } catch (error) {
    logger.error('Job response escalation cron failed unexpectedly', { err: error })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}