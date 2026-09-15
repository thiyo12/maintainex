import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveMatchingConfig } from '@/lib/matching'
import { expireOpportunities, advanceMatchingWave, shouldStopWaves } from '@/lib/matching/waves'
import { findCandidates } from '@/lib/matching'
import { createMatchingWave } from '@/lib/matching/waves'
import { createNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Step 1: Expire stale opportunities
    const expiredJobIds = await expireOpportunities(prisma)

    let advanced = 0
    let waved = 0
    let expired = 0

    // Step 2: For each expired job, try to advance to next wave
    for (const jobId of expiredJobIds) {
      const config = await resolveMatchingConfig(prisma, 'GLOBAL')
      const shouldStop = await shouldStopWaves(prisma, jobId)

      if (shouldStop.stop) {
        // Notify customer no providers available
        const job = await prisma.marketplaceJob.findUnique({
          where: { id: jobId },
          select: { customerId: true },
        })
        if (job) {
          await createNotification({
            userId: job.customerId,
            title: 'No taskers available right now',
            body: 'Try expanding your search or check back later. Your job is still posted.',
          })
        }
        expired++
        continue
      }

      const result = await advanceMatchingWave(prisma, jobId, config)
      if (!result.advanced) continue

      advanced++

      // Find candidates for next wave and create opportunities
      const job = await prisma.marketplaceJob.findUnique({
        where: { id: jobId },
        select: { categoryId: true, serviceTemplateId: true, countryCode: true },
      })
      if (!job) continue

      const matchResult = await findCandidates(prisma, {
        jobId,
        categoryId: job.categoryId,
        serviceTemplateId: job.serviceTemplateId || undefined,
        countryCode: job.countryCode || 'GLOBAL',
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
      })

      if (matchResult.candidates.length > 0) {
        await createMatchingWave(
          prisma,
          jobId,
          result.waveNumber,
          matchResult.candidates.slice(0, 10),
          config,
        )
        waved++
      }
    }

    return NextResponse.json({
      success: true,
      expiredJobs: expiredJobIds.length,
      advanced,
      waved,
      expired,
    })
  } catch (error) {
    console.error('[CRON] Wave matching error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
