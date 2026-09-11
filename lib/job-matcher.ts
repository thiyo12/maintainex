import { prisma } from './prisma'
import { getSetting } from './settings'
import { haversineKm } from './distance'
import { createNotification } from './notifications'

export interface MatchedTasker {
  id: string
  name: string
  pushToken: string | null
  latitude: number | null
  longitude: number | null
  compositeScore: number
  avgRating: number
  completionRate: number
  avgResponseMin: number
  lastActiveAt: Date | null
  distanceKm: number
  matchScore: number
  activeJobCount: number
}

/**
 * Called when a new job is posted.
 * Finds the best taskers and sends notifications in waves.
 */
export async function matchJobToTaskers(jobId: string, countryCode?: string): Promise<{ matched: number; totalCandidates: number }> {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'OPEN') return { matched: 0, totalCandidates: 0 }

  const jobCountry = countryCode || job.countryCode || 'LK'

  const category = await prisma.category.findUnique({ where: { id: job.categoryId } })
  if (!category) return { matched: 0, totalCandidates: 0 }

  const radiusKm = await getSetting('matching.radius_km', 50)
  const maxActiveJobs = await getSetting('matching.max_active_jobs', 3)

  // 1. Get all candidate taskers for this category — country-filtered at DB level
  const allProfiles = await prisma.taskerProfile.findMany({
    where: { isOnline: true, countryCode: jobCountry },
    include: { user: { select: { id: true, name: true, pushToken: true, isSuspended: true } } },
  })

  // Filter by skill match
  let candidates = allProfiles.filter(p => {
    if (!p.skills) return false
    try {
      const skills = JSON.parse(p.skills)
      return Array.isArray(skills) && skills.includes(category.slug)
    } catch {
      return p.skills.includes(category.slug)
    }
  })

  // 2. Hard filters
  const filtered: MatchedTasker[] = []
  for (const t of candidates) {
    if (t.user.isSuspended) continue
    if (!t.isVerified) continue

    // Count active jobs
    const activeJobCount = await prisma.assignment.count({
      where: {
        taskerId: t.id,
        status: { in: ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'] },
      },
    })
    if (activeJobCount >= maxActiveJobs) continue

    // Distance check
    let distanceKm = 0
    if (job.latitude && job.longitude && t.latitude && t.longitude) {
      distanceKm = haversineKm(job.latitude, job.longitude, t.latitude, t.longitude)
      if (distanceKm > radiusKm) continue
    }

    // Get response time data
    const responseStats = await prisma.providerJobResponse.aggregate({
      where: {
        providerId: t.userId,
        respondedAt: { not: null },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _avg: { responseTimeMinutes: true },
    })
    const avgResponseMin = responseStats._avg.responseTimeMinutes || 60

    // Last active
    const lastResponse = await prisma.providerJobResponse.findFirst({
      where: { providerId: t.userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    filtered.push({
      id: t.userId,
      name: t.user.name || 'Unknown',
      pushToken: t.user.pushToken,
      latitude: t.latitude,
      longitude: t.longitude,
      compositeScore: t.compositeScore,
      avgRating: t.rating,
      completionRate: t.completionRate,
      avgResponseMin,
      lastActiveAt: lastResponse?.createdAt || null,
      distanceKm,
      matchScore: 0,
      activeJobCount,
    })
  }

  if (filtered.length === 0) {
    // Notify customer no match
    const customer = await prisma.user.findUnique({ where: { id: job.customerId }, select: { pushToken: true } })
    if (customer?.pushToken) {
      await createNotification({
        userId: job.customerId,
        title: 'No taskers available right now',
        body: 'Try expanding your search or check back later. Your job is still posted.',
      })
    }
    return { matched: 0, totalCandidates: 0 }
  }

  // 3. Score every candidate
  const weights = {
    rating: await getSetting('score.weight_rating', 35),
    distance: await getSetting('score.weight_distance', 30),
    completion: await getSetting('score.weight_completion', 20),
    speed: await getSetting('score.weight_speed', 10),
    activity: await getSetting('score.weight_activity', 5),
  }

  for (const t of filtered) {
    const ratingScore = (t.avgRating / 5) * weights.rating
    const distanceScore = (1 - Math.min(t.distanceKm, 50) / 50) * weights.distance
    const completionScore = (t.completionRate / 100) * weights.completion
    const speedScore = t.avgResponseMin <= 5
      ? weights.speed
      : Math.max(0, weights.speed - (t.avgResponseMin / 60) * weights.speed)
    const daysSinceActive = t.lastActiveAt
      ? (Date.now() - new Date(t.lastActiveAt).getTime()) / 86400000
      : 999
    const activityScore = daysSinceActive <= 7 ? weights.activity : 0

    t.matchScore = Math.round((ratingScore + distanceScore + completionScore + speedScore + activityScore) * 100) / 100
  }

  // 4. Sort by score descending
  filtered.sort((a, b) => b.matchScore - a.matchScore)

  // 5. Store all ranked candidates in job_match_queue
  await prisma.jobMatchQueue.deleteMany({ where: { jobId } })
  for (let i = 0; i < filtered.length; i++) {
    await prisma.jobMatchQueue.create({
      data: {
        jobId,
        taskerId: filtered[i].id,
        score: filtered[i].matchScore,
        rank: i + 1,
        status: 'pending',
      },
    })
  }

  // 6. Send wave 1 notifications
  await sendMatchWave(jobId, 1)

  return { matched: filtered.length, totalCandidates: candidates.length }
}

export async function sendMatchWave(jobId: string, wave: number): Promise<void> {
  const waveSizes: Record<number, number> = {
    1: await getSetting('matching.max_notify_wave1', 3),
    2: await getSetting('matching.max_notify_wave2', 4),
    3: await getSetting('matching.max_notify_wave3', 3),
  }
  const waveSize = waveSizes[wave] || 3

  const toNotify = await prisma.jobMatchQueue.findMany({
    where: { jobId, status: 'pending' },
    orderBy: { rank: 'asc' },
    take: waveSize,
    include: {
      tasker: { include: { user: { select: { pushToken: true, name: true } } } },
      job: { select: { title: true } },
    },
  })

  for (const entry of toNotify) {
    await prisma.jobMatchQueue.update({
      where: { jobId_taskerId: { jobId, taskerId: entry.taskerId } },
      data: { status: 'notified', notifiedAt: new Date(), wave },
    })

    if (entry.tasker.user.pushToken) {
      await createNotification({
        userId: entry.taskerId,
        title: 'New Job Near You',
        body: `${entry.job.title} — tap to view and apply`,
        referenceType: 'JOB_MATCH',
        referenceId: jobId,
      })
    }
  }

  await prisma.marketplaceJob.update({
    where: { id: jobId },
    data: { currentWave: wave, waveSentAt: new Date() },
  })
}

export async function taskerRespondToMatch(jobId: string, taskerId: string, accepted: boolean): Promise<void> {
  const queueEntry = await prisma.jobMatchQueue.findUnique({
    where: { jobId_taskerId: { jobId, taskerId } },
  })
  if (!queueEntry || queueEntry.status !== 'notified') return

  await prisma.jobMatchQueue.update({
    where: { jobId_taskerId: { jobId, taskerId } },
    data: { status: accepted ? 'accepted' : 'declined', respondedAt: new Date() },
  })

  if (!accepted) {
    // Check if tasker has too many declines — deprioritize
    const declineCount = await prisma.jobMatchQueue.count({
      where: { taskerId, status: 'declined' },
    })
    const maxDeclines = await getSetting('offer.max_decline_before_depriority', 3)
    if (declineCount >= maxDeclines) {
      // Demote their composite score slightly
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: taskerId },
        select: { compositeScore: true },
      })
      if (profile) {
        await prisma.taskerProfile.update({
          where: { userId: taskerId },
          data: { compositeScore: Math.max(0, profile.compositeScore - 5) },
        })
      }
    }
  }
}

export async function expireWaveMatches(jobId: string): Promise<void> {
  // Expire all notified entries that haven't responded
  await prisma.jobMatchQueue.updateMany({
    where: { jobId, status: 'notified' },
    data: { status: 'expired' },
  })
}
