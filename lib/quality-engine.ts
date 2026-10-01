import { prisma } from './prisma'

export interface QualityResult {
  providerId: string
  qualityScore: number
  avgReviewRating: number
  jobCompletionRate: number
  onTimeRate: number
  disputeRate: number
  totalJobs: number
  completedJobs: number
  isFlagged: boolean
  warnings: string[]
}

export async function calculateProviderQuality(providerId: string): Promise<QualityResult> {
  const [reviews, providerResponses] = await Promise.all([
    prisma.jobReview.findMany({
      where: { providerId },
      select: { quality: true, communication: true, timeliness: true },
    }),
    prisma.providerJobResponse.findMany({
      where: { providerId },
      select: { jobId: true, completedAt: true, wasOnTime: true },
    }),
  ])

  const avgReviewRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + (r.quality + r.communication + r.timeliness) / 3, 0) / reviews.length
    : 0

  const providerCompletedJobs = providerResponses.filter(response => response.completedAt != null).length
  const providerTotalJobs = providerResponses.length
  const completionRate = providerTotalJobs > 0
    ? Math.min(100, (providerCompletedJobs / providerTotalJobs) * 100)
    : 100

  const onTimeJobs = providerResponses.filter(
    response => response.completedAt != null && response.wasOnTime === true
  ).length
  const onTimeRate = providerCompletedJobs > 0
    ? (onTimeJobs / providerCompletedJobs) * 100
    : 100

  const providerJobIds = [...new Set(providerResponses.map(response => response.jobId))]
  const providerDisputedJobs = providerJobIds.length > 0
    ? await prisma.jobWorkspace.count({
        where: {
          jobId: { in: providerJobIds },
          progressStatus: 'DISPUTED',
        },
      })
    : 0

  const disputeRate = providerTotalJobs > 0
    ? (providerDisputedJobs / providerTotalJobs) * 100
    : 0

  const warnings: string[] = []
  let isFlagged = false

  if (avgReviewRating > 0 && avgReviewRating < 2.0) {
    warnings.push('Low average rating — below 2.0')
    isFlagged = true
  }
  if (completionRate < 70) {
    warnings.push('Low completion rate — below 70%')
    isFlagged = true
  }
  if (disputeRate > 15) {
    warnings.push('High dispute rate — above 15%')
    isFlagged = true
  }
  if (providerCompletedJobs >= 3 && avgReviewRating < 3.0) {
    warnings.push('Mediocre rating with experience — consider improvement plan')
  }

  const qualityScore = Math.round(
    (avgReviewRating / 5) * 35 +
    (completionRate / 100) * 25 +
    (onTimeRate / 100) * 20 +
    Math.max(0, 1 - disputeRate / 100) * 10 +
    (reviews.length > 0 ? 10 : 0)
  )

  await prisma.qualityMetric.upsert({
    where: { providerId },
    create: {
      providerId,
      providerType: 'INDIVIDUAL',
      qualityScore,
      avgReviewRating,
      jobCompletionRate: completionRate,
      onTimeRate,
      disputeRate,
      totalJobs: providerTotalJobs,
      completedJobs: providerCompletedJobs,
      disputedJobs: providerDisputedJobs,
      totalReviews: reviews.length,
      isFlagged,
    },
    update: {
      qualityScore,
      avgReviewRating,
      jobCompletionRate: completionRate,
      onTimeRate,
      disputeRate,
      totalJobs: providerTotalJobs,
      completedJobs: providerCompletedJobs,
      disputedJobs: providerDisputedJobs,
      totalReviews: reviews.length,
      isFlagged,
    },
  })

  return {
    providerId,
    qualityScore,
    avgReviewRating,
    jobCompletionRate: completionRate,
    onTimeRate,
    disputeRate,
    totalJobs: providerTotalJobs,
    completedJobs: providerCompletedJobs,
    isFlagged,
    warnings,
  }
}

export async function batchUpdateAllQualities(): Promise<number> {
  const providers = await prisma.taskerProfile.findMany({ select: { userId: true } })
  let count = 0
  for (const p of providers) {
    try {
      await calculateProviderQuality(p.userId)
      count++
    } catch {}
  }
  return count
}
