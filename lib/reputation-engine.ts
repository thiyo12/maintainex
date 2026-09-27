import { prisma } from './prisma'
import { getSetting } from './settings'
import { createNotification } from './notifications'

/**
 * Recalculate a tasker's full reputation score.
 * Called after every review, job completion, or cancellation.
 */
export async function recalculateReputation(taskerId: string): Promise<{
  avgRating: number
  completionRate: number
  compositeScore: number
}> {
  // 1. Weighted rolling average rating (legacy TaskerReview + v2 JobReview)
  const legacyReviews = await prisma.taskerReview.findMany({
    where: { taskerId: taskerId },
    orderBy: { createdAt: 'desc' },
    select: { rating: true, createdAt: true },
  })
  const marketplaceReviews = await prisma.jobReview.findMany({
    where: { providerId: taskerId },
    orderBy: { createdAt: 'desc' },
    select: { quality: true, communication: true, timeliness: true, createdAt: true },
  })
  const reviews = [
    ...legacyReviews,
    ...marketplaceReviews.map((r) => ({
      rating: (r.quality + r.communication + r.timeliness) / 3,
      createdAt: r.createdAt,
    })),
  ]

  let weightedSum = 0
  let weightTotal = 0
  for (const r of reviews) {
    const daysAgo = (Date.now() - new Date(r.createdAt).getTime()) / 86400000
    const weight = 1 / (daysAgo / 30 + 1)
    weightedSum += r.rating * weight
    weightTotal += weight
  }
  const avgRating = weightTotal > 0
    ? Math.round((weightedSum / weightTotal) * 10) / 10
    : 0

  // 2. Completion rate
  const totalJobs = await prisma.assignment.count({
    where: { taskerId, status: { in: ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] } },
  })
  const completedJobs = await prisma.assignment.count({
    where: { taskerId, status: 'COMPLETED' },
  })
  const completionRate = totalJobs > 0
    ? Math.round((completedJobs / totalJobs) * 100)
    : 100

  // 3. Average response time (last 30 days)
  const respData = await prisma.providerJobResponse.aggregate({
    where: {
      providerId: taskerId,
      respondedAt: { not: null },
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    _avg: { responseTimeMinutes: true },
  })
  const avgResponseMin = respData._avg.responseTimeMinutes || 60

  // 4. Activity (last 7 days)
  const recentJobs = await prisma.assignment.count({
    where: {
      taskerId,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  })
  const isRecentlyActive = recentJobs > 0

  // 5. Penalty points
  const profile = await prisma.taskerProfile.findUnique({
    where: { userId: taskerId },
    select: { penaltyPoints: true },
  })
  const penaltyDeduction = profile?.penaltyPoints || 0

  // 6. Composite score
  const weights = {
    rating: await getSetting('score.weight_rating', 35),
    distance: await getSetting('score.weight_distance', 30),
    completion: await getSetting('score.weight_completion', 20),
    speed: await getSetting('score.weight_speed', 10),
    activity: await getSetting('score.weight_activity', 5),
  }

  const ratingScore = (avgRating / 5) * weights.rating
  const completionScore = (completionRate / 100) * weights.completion
  const speedScore = avgResponseMin <= 5
    ? weights.speed
    : Math.max(0, weights.speed - (avgResponseMin / 60) * weights.speed)
  const activityScore = isRecentlyActive ? weights.activity : 0
  const distanceAllocation = weights.distance

  const compositeScore = Math.max(0, Math.round(
    ratingScore + distanceAllocation + completionScore +
    speedScore + activityScore - penaltyDeduction
  ))

  // 7. Update tasker_profiles
  await prisma.taskerProfile.update({
    where: { userId: taskerId },
    data: {
      rating: avgRating,
      completionRate,
      avgResponseMin: Math.round(avgResponseMin),
      compositeScore,
      scoreUpdatedAt: new Date(),
    },
  })

  // 8. Award / revoke badges
  await updateBadges(taskerId, avgRating, completedJobs, compositeScore)

  return { avgRating, completionRate, compositeScore }
}

async function updateBadges(taskerId: string, rating: number, completedJobs: number, score: number): Promise<void> {
  const topProMinJobs = await getSetting('reputation.top_pro_min_jobs', 50)
  const topProMinRating = await getSetting('reputation.top_pro_min_rating', 4.8)

  const badgeChecks = [
    {
      id: 'top_pro',
      label: 'Top Pro',
      award: rating >= topProMinRating && completedJobs >= topProMinJobs,
    },
    {
      id: 'fast_responder',
      label: 'Fast Responder',
      award: await checkFastResponder(taskerId),
    },
    {
      id: 'rising_star',
      label: 'Rising Star',
      award: completedJobs >= 5 && completedJobs < topProMinJobs && rating >= 4.5,
    },
  ]

  for (const badge of badgeChecks) {
    const existing = await prisma.taskerBadge.findUnique({
      where: { userId_badgeId: { userId: taskerId, badgeId: badge.id } },
    })
    if (badge.award && !existing) {
      await prisma.taskerBadge.create({
        data: { userId: taskerId, badgeId: badge.id, label: badge.label },
      })
    } else if (!badge.award && existing) {
      await prisma.taskerBadge.delete({
        where: { userId_badgeId: { userId: taskerId, badgeId: badge.id } },
      })
    }
  }
}

async function checkFastResponder(taskerId: string): Promise<boolean> {
  const data = await prisma.providerJobResponse.aggregate({
    where: {
      providerId: taskerId,
      respondedAt: { not: null },
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    _avg: { responseTimeMinutes: true },
  })
  return (data._avg.responseTimeMinutes || 999) <= 5
}

export async function applyPenalty(taskerId: string, type: 'cancellation' | 'noshow'): Promise<void> {
  const penaltyPts = {
    cancellation: await getSetting('reputation.cancel_penalty_pts', 5),
    noshow: await getSetting('reputation.noshow_penalty_pts', 3),
  }
  const pts = penaltyPts[type] || 0

  await prisma.taskerProfile.update({
    where: { userId: taskerId },
    data: { penaltyPoints: { increment: pts } },
  })

  // Check cancellation threshold
  const warnThreshold = await getSetting('reputation.warn_cancel_count', 3)
  const suspendThreshold = await getSetting('reputation.suspend_cancel_count', 5)
  const suspendDays = await getSetting('reputation.suspend_days', 7)

  const recentCancels = await prisma.assignment.count({
    where: {
      taskerId,
      status: 'CANCELLED',
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  })

  if (recentCancels >= suspendThreshold) {
    await prisma.user.update({
      where: { id: taskerId },
      data: {
        isSuspended: true,
        suspendedUntil: new Date(Date.now() + suspendDays * 24 * 60 * 60 * 1000),
        suspensionReason: 'Too many cancellations in 30 days',
      },
    })
    await createNotification({
      userId: taskerId,
      title: 'Account Suspended',
      body: `Your account has been suspended for ${suspendDays} days due to excessive cancellations.`,
    })
  } else if (recentCancels >= warnThreshold) {
    await createNotification({
      userId: taskerId,
      title: 'Warning: Too Many Cancellations',
      body: `You have cancelled ${recentCancels} jobs this month. Reaching ${suspendThreshold} will suspend your account.`,
    })
  }

  await recalculateReputation(taskerId)
}

export async function recoverPenaltyPoints(taskerId: string, rating: number): Promise<void> {
  if (rating >= 4) {
    await prisma.taskerProfile.update({
      where: { userId: taskerId },
      data: { penaltyPoints: { decrement: 1 } },
    })
  }
}
