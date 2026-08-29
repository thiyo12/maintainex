import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSetting } from '@/lib/settings'
import { sendMatchWave } from '@/lib/job-matcher'
import { createNotification } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const wave1Wait = await getSetting('matching.wave1_wait_min', 15)
    const wave2Wait = await getSetting('matching.wave2_wait_min', 15)
    const wave3Wait = await getSetting('matching.wave3_wait_min', 15)

    // Wave 2: jobs in wave 1 with no accept yet
    const wave1Jobs = await prisma.marketplaceJob.findMany({
      where: {
        status: 'OPEN',
        currentWave: 1,
        waveSentAt: { lte: new Date(Date.now() - wave1Wait * 60 * 1000) },
      },
    })

    for (const job of wave1Jobs) {
      const hasAccepted = await prisma.jobMatchQueue.findFirst({
        where: { jobId: job.id, status: 'accepted' },
      })
      if (!hasAccepted) {
        await sendMatchWave(job.id, 2)
      }
    }

    // Wave 3: jobs in wave 2 with no accept
    const wave2Jobs = await prisma.marketplaceJob.findMany({
      where: {
        status: 'OPEN',
        currentWave: 2,
        waveSentAt: { lte: new Date(Date.now() - wave2Wait * 60 * 1000) },
      },
    })

    for (const job of wave2Jobs) {
      const hasAccepted = await prisma.jobMatchQueue.findFirst({
        where: { jobId: job.id, status: 'accepted' },
      })
      if (!hasAccepted) {
        await sendMatchWave(job.id, 3)
      }
    }

    // No match: jobs in wave 3 that expired
    const expiredJobs = await prisma.marketplaceJob.findMany({
      where: {
        status: 'OPEN',
        currentWave: 3,
        waveSentAt: { lte: new Date(Date.now() - wave3Wait * 60 * 1000) },
      },
    })

    for (const job of expiredJobs) {
      const hasAccepted = await prisma.jobMatchQueue.findFirst({
        where: { jobId: job.id, status: 'accepted' },
      })
      if (!hasAccepted) {
        await createNotification({
          userId: job.customerId,
          title: 'No taskers available right now',
          body: 'Try expanding your search or check back later. Your job is still posted.',
        })
        await prisma.marketplaceJob.update({
          where: { id: job.id },
          data: { currentWave: 0 },
        })
      }
    }

    return NextResponse.json({
      success: true,
      wave2: wave1Jobs.length,
      wave3: wave2Jobs.length,
      expired: expiredJobs.length,
    })
  } catch (error) {
    console.error('[CRON] Wave matching error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
