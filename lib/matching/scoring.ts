import { ScoreComponents } from './types'

export const MATCHING_SCORE_VERSION = 'v2'

export const DEFAULT_WEIGHTS: ScoreComponents = {
  capability: 30,
  reliability: 20,
  reputation: 20,
  availability: 15,
  travel: 10,
  experience: 5,
  fairness: 0,
  preferredSkill: 0,
}

export function validateWeights(weights: ScoreComponents): boolean {
  const sum = weights.capability + weights.reliability + weights.reputation +
    weights.availability + weights.travel + weights.experience +
    weights.fairness + weights.preferredSkill
  if (sum !== 100) return false
  for (const v of Object.values(weights)) {
    if (v < 0 || v > 100) return false
  }
  return true
}

export function computeCapabilityScore(
  providerSkills: string[],
  jobCategoryId: string,
  jobServiceTemplateId?: string,
): number {
  if (providerSkills.length === 0) return 0
  const normalizedSkills = providerSkills.map(s => s.toLowerCase().trim())

  if (jobServiceTemplateId) {
    if (normalizedSkills.includes(jobServiceTemplateId.toLowerCase())) return 100
    if (normalizedSkills.includes(jobCategoryId.toLowerCase())) return 70
    return 30
  }

  if (normalizedSkills.includes(jobCategoryId.toLowerCase())) return 100
  return 20
}

export function computeReliabilityScore(
  completedJobs: number,
  cancellationRate: number,
): number {
  if (completedJobs === 0) return 50
  const completionRate = 1 - cancellationRate
  const volumeScore = Math.min(100, completedJobs * 2)
  return Math.round(completionRate * 70 + (volumeScore / 100) * 30)
}

export function computeReputationScore(
  rating: number,
  reviewCount: number,
): number {
  if (reviewCount === 0) return 50
  const ratingScore = (rating / 5) * 80
  const confidenceBonus = Math.min(20, reviewCount * 2)
  return Math.round(ratingScore + confidenceBonus)
}

export function computeAvailabilityScore(
  isAvailable: boolean,
  hasConflictingJobs: boolean,
  responseRate: number,
): number {
  if (!isAvailable) return 0
  let score = 60
  if (!hasConflictingJobs) score += 20
  score += Math.round(responseRate * 20)
  return Math.min(100, score)
}

export function computeTravelScore(
  providerHasServiceArea: boolean,
  distanceKm: number | null,
  isRemoteJob: boolean,
): number {
  if (isRemoteJob) return 100
  if (!providerHasServiceArea) return 50
  if (distanceKm === null) return 70
  if (distanceKm <= 5) return 100
  if (distanceKm <= 10) return 85
  if (distanceKm <= 20) return 70
  if (distanceKm <= 50) return 50
  return 20
}

export function computeExperienceScore(
  relevantCompletedJobs: number,
  yearsActive: number,
): number {
  const jobScore = Math.min(60, relevantCompletedJobs * 3)
  const timeScore = Math.min(40, yearsActive * 8)
  return Math.round(jobScore + timeScore)
}

export function computeFairnessScore(
  opportunitiesLast7Days: number,
  opportunitiesLast30Days: number,
  jobsWonLast30Days: number,
  daysSinceLastOpportunity: number,
  medianOpportunities: number,
): number {
  if (medianOpportunities === 0) return 50

  // Lower recent opportunities relative to median = higher fairness score
  const recentRatio = opportunitiesLast7Days / Math.max(medianOpportunities / 4, 1)
  const monthlyRatio = opportunitiesLast30Days / Math.max(medianOpportunities, 1)

  let score = 50 // neutral baseline

  // Boost for under-served providers
  if (recentRatio < 0.5) score += 20
  else if (recentRatio < 0.8) score += 10
  else if (recentRatio > 1.5) score -= 10
  else if (recentRatio > 2.0) score -= 20

  // Time since last opportunity factor
  if (daysSinceLastOpportunity > 14) score += 15
  else if (daysSinceLastOpportunity > 7) score += 10
  else if (daysSinceLastOpportunity > 3) score += 5

  // Penalize providers who win most of what they're offered (concentration)
  if (monthlyRatio > 0 && jobsWonLast30Days > 0) {
    const winRate = jobsWonLast30Days / Math.max(opportunitiesLast30Days, 1)
    if (winRate > 0.8 && opportunitiesLast30Days > 5) score -= 10
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function computePreferredSkillScore(
  preferredSkillsMatched: number,
  totalPreferredSkills: number,
): number {
  if (totalPreferredSkills === 0) return 50
  const ratio = preferredSkillsMatched / totalPreferredSkills
  return Math.round(50 + ratio * 50)
}

export function computeNewProviderScore(
  completedJobs: number,
  baseline: number,
): number {
  if (completedJobs > 10) return 0
  if (completedJobs === 0) return baseline
  return Math.round(baseline * (1 - completedJobs / 10))
}

export function computeTotalScore(
  components: ScoreComponents,
  weights: ScoreComponents,
): number {
  return Math.round(
    (components.capability * weights.capability +
      components.reliability * weights.reliability +
      components.reputation * weights.reputation +
      components.availability * weights.availability +
      components.travel * weights.travel +
      components.experience * weights.experience +
      components.fairness * weights.fairness +
      components.preferredSkill * weights.preferredSkill) / 100
  )
}
