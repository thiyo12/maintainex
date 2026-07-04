import { prisma } from './prisma'

export interface TrustResult {
  customerId: string
  trustScore: number
  level: 'untrusted' | 'low' | 'normal' | 'high' | 'trusted'
  totalJobsPosted: number
  completedJobs: number
  cancelledJobs: number
  warnings: string[]
}

function getTrustLevel(score: number): TrustResult['level'] {
  if (score < 0.3) return 'untrusted'
  if (score < 0.7) return 'low'
  if (score < 1.3) return 'normal'
  if (score < 1.7) return 'high'
  return 'trusted'
}

export async function calculateCustomerTrust(customerId: string): Promise<TrustResult> {
  const [jobs, providerReviews, jobReviews] = await Promise.all([
    prisma.marketplaceJob.findMany({
      where: { customerId },
      select: { id: true, status: true, createdAt: true },
    }),
    prisma.providerReview.findMany({
      where: { customerId },
      select: { overallExperience: true, communication: true },
    }),
    prisma.jobReview.findMany({
      where: { customerId },
      select: { quality: true, communication: true, timeliness: true },
    }),
  ])

  const totalJobsPosted = jobs.length
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length
  const cancelledJobs = jobs.filter(j => j.status === 'CANCELLED').length

  let trustScore = 1.0
  const warnings: string[] = []

  const cancellationRate = totalJobsPosted > 0 ? cancelledJobs / totalJobsPosted : 0
  if (cancellationRate > 0.3 && totalJobsPosted >= 3) {
    trustScore -= 0.3
    warnings.push('High cancellation rate')
  } else if (cancellationRate > 0.15 && totalJobsPosted >= 3) {
    trustScore -= 0.15
    warnings.push('Moderate cancellation rate')
  }

  if (completedJobs >= 1) trustScore += Math.min(0.5, completedJobs * 0.05)
  if (completedJobs >= 1) trustScore += Math.min(0.3, completedJobs * 0.03)

  const positiveProviderReviews = providerReviews.filter(r => r.overallExperience >= 4).length
  if (positiveProviderReviews > 0) {
    trustScore += Math.min(0.3, positiveProviderReviews * 0.1)
  }

  const negativeProviderReviews = providerReviews.filter(r => r.overallExperience <= 2).length
  if (negativeProviderReviews > 0) {
    trustScore -= Math.min(0.3, negativeProviderReviews * 0.1)
    warnings.push(`${negativeProviderReviews} negative review(s) from providers`)
  }

  trustScore = Math.max(0, Math.min(2, trustScore))

  await prisma.customerTrustScore.upsert({
    where: { customerId },
    create: {
      customerId,
      trustScore,
      totalJobsPosted,
      completedJobs,
      cancelledJobs,
      avgProviderRating: providerReviews.length > 0
        ? providerReviews.reduce((s, r) => s + r.overallExperience, 0) / providerReviews.length
        : 0,
      positiveReviews: positiveProviderReviews,
    },
    update: {
      trustScore,
      totalJobsPosted,
      completedJobs,
      cancelledJobs,
      avgProviderRating: providerReviews.length > 0
        ? providerReviews.reduce((s, r) => s + r.overallExperience, 0) / providerReviews.length
        : 0,
      positiveReviews: positiveProviderReviews,
    },
  })

  return {
    customerId,
    trustScore: Math.round(trustScore * 100) / 100,
    level: getTrustLevel(trustScore),
    totalJobsPosted,
    completedJobs,
    cancelledJobs,
    warnings,
  }
}

export async function batchUpdateAllTrustScores(): Promise<number> {
  const customers = await prisma.marketplaceJob.findMany({
    select: { customerId: true },
    distinct: ['customerId'],
  })
  let count = 0
  for (const c of customers) {
    try {
      await calculateCustomerTrust(c.customerId)
      count++
    } catch {}
  }
  return count
}
