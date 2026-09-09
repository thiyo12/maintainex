import { PrismaClient } from '@prisma/client'
import { checkIndividualProviderEligibility, checkCompanyEligibility } from '@/lib/phase6/provider-eligibility'
import {
  MatchingInput, MatchResult, MatchCandidate, ExcludedProvider,
  ProviderType, MatchingConfig, ScoreComponents, MatchExclusionReason,
} from './types'
import {
  DEFAULT_WEIGHTS, MATCHING_SCORE_VERSION, validateWeights,
  computeCapabilityScore, computeReliabilityScore, computeReputationScore,
  computeAvailabilityScore, computeTravelScore, computeExperienceScore,
  computeTotalScore,
} from './scoring'
import { rankCandidates } from './ranking'
import { buildExplanationReasons } from './explanations'

const NEUTRAL_SCORE = 50

const DEFAULT_CONFIG: MatchingConfig = {
  countryCode: 'GLOBAL',
  matchingVersion: MATCHING_SCORE_VERSION,
  weights: { ...DEFAULT_WEIGHTS },
}

export function hasCapabilityMatch(
  providerSkills: string[],
  jobCategoryId: string,
  jobServiceTemplateId?: string | null,
): boolean {
  if (providerSkills.length === 0) return false
  const normalized = providerSkills.map(s => s.toLowerCase().trim())

  if (jobServiceTemplateId) {
    if (normalized.includes(jobServiceTemplateId.toLowerCase())) return true
    if (normalized.includes(jobCategoryId.toLowerCase())) return true
    return false
  }

  if (normalized.includes(jobCategoryId.toLowerCase())) return true
  const partialMatch = normalized.some(s =>
    jobCategoryId.toLowerCase().includes(s) || s.includes(jobCategoryId.toLowerCase())
  )
  return partialMatch
}

export async function resolveMatchingConfig(
  client: PrismaClient,
  countryCode: string,
): Promise<MatchingConfig> {
  const row = await (client as any).marketConfig.findUnique({
    where: { countryCode },
  }).catch(() => null)

  const globalRow = countryCode !== 'GLOBAL'
    ? await (client as any).marketConfig.findUnique({ where: { countryCode: 'GLOBAL' } }).catch(() => null)
    : null

  const cfg = row || globalRow
  if (!cfg) return { ...DEFAULT_CONFIG, countryCode }

  const weights: ScoreComponents = {
    capability: cfg.weightCapability,
    reliability: cfg.weightReliability,
    reputation: cfg.weightReputation,
    availability: cfg.weightAvailability,
    travel: cfg.weightTravel,
    experience: cfg.weightExperience,
  }

  return {
    countryCode,
    matchingVersion: cfg.matchingVersion || MATCHING_SCORE_VERSION,
    weights: validateWeights(weights) ? weights : { ...DEFAULT_WEIGHTS },
  }
}

export async function findCandidates(
  client: PrismaClient,
  input: MatchingInput,
): Promise<MatchResult> {
  const config = await resolveMatchingConfig(client, input.countryCode || 'GLOBAL')
  const excluded: ExcludedProvider[] = []
  const candidates: MatchCandidate[] = []

  const job = await client.marketplaceJob.findUnique({
    where: { id: input.jobId },
    select: { categoryId: true, serviceTemplateId: true, customerId: true },
  })
  if (!job) {
    return { jobId: input.jobId, candidates: [], excluded: [], scoreVersion: config.matchingVersion, generatedAt: new Date() }
  }

  const individualProfiles = await client.taskerProfile.findMany({
    where: { verificationStatus: 'VERIFIED', isVerified: true },
    include: { user: { select: { id: true, isSuspended: true, isBanned: true, identityStatus: true, createdAt: true } } },
  })

  for (const profile of individualProfiles) {
    if (!profile.user || profile.user.isSuspended || profile.user.isBanned) {
      excluded.push({
        providerId: profile.userId,
        providerType: 'INDIVIDUAL',
        reason: profile.user?.isSuspended ? 'PROVIDER_SUSPENDED' : 'PROVIDER_BANNED',
      })
      continue
    }

    if (profile.user.identityStatus !== 'VERIFIED') {
      excluded.push({ providerId: profile.userId, providerType: 'INDIVIDUAL', reason: 'IDENTITY_NOT_VERIFIED' })
      continue
    }

    const eligibility = await checkIndividualProviderEligibility(profile.userId)
    if (!eligibility.eligible) {
      const reason = mapEligibilityReason(eligibility.reasons[0])
      excluded.push({ providerId: profile.userId, providerType: 'INDIVIDUAL', reason, detail: eligibility.reasons.join('; ') })
      continue
    }

    const skills = parseSkills(profile.skills)
    if (!hasCapabilityMatch(skills, job.categoryId, job.serviceTemplateId)) {
      excluded.push({ providerId: profile.userId, providerType: 'INDIVIDUAL', reason: 'CAPABILITY_MISMATCH', detail: `Provider skills [${skills.join(', ')}] do not match job categoryId=${job.categoryId}` })
      continue
    }

    const components = scoreIndividual(profile, job.categoryId, job.serviceTemplateId, input)
    const totalScore = computeTotalScore(components, config.weights)

    candidates.push({
      providerId: profile.userId,
      providerType: 'INDIVIDUAL',
      userId: profile.userId,
      score: totalScore,
      rank: 0,
      scoreVersion: config.matchingVersion,
      components,
      reasons: buildExplanationReasons(components, 'INDIVIDUAL'),
    })
  }

  const companies = await client.companyProfile.findMany({
    where: { verificationStatus: 'VERIFIED', isVerified: true },
    include: { user: { select: { id: true, isSuspended: true, isBanned: true } } },
  })

  for (const company of companies) {
    if (company.user?.isSuspended) {
      excluded.push({ providerId: company.id, providerType: 'COMPANY', reason: 'COMPANY_OWNER_SUSPENDED' })
      continue
    }
    if (company.user?.isBanned) {
      excluded.push({ providerId: company.id, providerType: 'COMPANY', reason: 'COMPANY_OWNER_BANNED' })
      continue
    }

    const companyEligibility = await checkCompanyEligibility(company.id)
    if (!companyEligibility.eligible) {
      const reason = mapCompanyEligibilityReason(companyEligibility.reasons[0])
      excluded.push({ providerId: company.id, providerType: 'COMPANY', reason, detail: companyEligibility.reasons.join('; ') })
      continue
    }

    const companySkills = parseSkills(company.services)
    if (!hasCapabilityMatch(companySkills, job.categoryId, job.serviceTemplateId)) {
      excluded.push({ providerId: company.id, providerType: 'COMPANY', reason: 'CAPABILITY_MISMATCH', detail: `Company services [${companySkills.join(', ')}] do not match job categoryId=${job.categoryId}` })
      continue
    }

    const components = scoreCompany(company, job.categoryId, job.serviceTemplateId, input)
    const totalScore = computeTotalScore(components, config.weights)

    candidates.push({
      providerId: company.id,
      providerType: 'COMPANY',
      companyId: company.id,
      userId: company.userId,
      score: totalScore,
      rank: 0,
      scoreVersion: config.matchingVersion,
      components,
      reasons: buildExplanationReasons(components, 'COMPANY'),
    })
  }

  const ranked = rankCandidates(candidates)

  return {
    jobId: input.jobId,
    candidates: ranked,
    excluded,
    scoreVersion: config.matchingVersion,
    generatedAt: new Date(),
  }
}

function scoreIndividual(
  profile: any,
  categoryId: string,
  serviceTemplateId: string | null,
  input: MatchingInput,
): ScoreComponents {
  const skills = parseSkills(profile.skills)
  const completedJobs = profile.completedJobs || 0
  const rating = profile.rating || 0
  const reviewCount = profile.completedJobs || 0

  return {
    capability: computeCapabilityScore(skills, categoryId, serviceTemplateId || undefined),
    reliability: computeReliabilityScore(completedJobs, 0),
    reputation: computeReputationScore(rating, reviewCount),
    availability: NEUTRAL_SCORE,
    travel: NEUTRAL_SCORE,
    experience: computeExperienceScore(completedJobs, 0),
  }
}

function scoreCompany(
  company: any,
  categoryId: string,
  serviceTemplateId: string | null,
  input: MatchingInput,
): ScoreComponents {
  const skills = parseSkills(company.services)
  const completedProjects = company.completedProjects || 0
  const rating = company.rating || 0

  return {
    capability: computeCapabilityScore(skills, categoryId, serviceTemplateId || undefined),
    reliability: computeReliabilityScore(completedProjects, 0),
    reputation: computeReputationScore(rating, completedProjects),
    availability: NEUTRAL_SCORE,
    travel: NEUTRAL_SCORE,
    experience: computeExperienceScore(completedProjects, 0),
  }
}

function parseSkills(skillsJson: string | null): string[] {
  if (!skillsJson || skillsJson === '[]' || skillsJson === '') return []
  try {
    const parsed = JSON.parse(skillsJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapEligibilityReason(reason: string): MatchExclusionReason {
  if (reason.includes('suspended')) return 'PROVIDER_SUSPENDED'
  if (reason.includes('banned')) return 'PROVIDER_BANNED'
  if (reason.includes('not found')) return 'PROVIDER_NOT_FOUND'
  if (reason.includes('profile not found')) return 'NO_PROVIDER_PROFILE'
  if (reason.includes('verification')) return 'PROVIDER_VERIFICATION_NOT_APPROVED'
  if (reason.includes('capabilities')) return 'NO_SERVICE_CAPABILITIES'
  if (reason.includes('capability') || reason.includes('lacks')) return 'CAPABILITY_MISMATCH'
  if (reason.includes('Identity')) return 'IDENTITY_NOT_VERIFIED'
  return 'PROVIDER_NOT_FOUND'
}

function mapCompanyEligibilityReason(reason: string): MatchExclusionReason {
  if (reason.includes('suspended')) return 'COMPANY_OWNER_SUSPENDED'
  if (reason.includes('banned')) return 'COMPANY_OWNER_BANNED'
  if (reason.includes('not found')) return 'PROVIDER_NOT_FOUND'
  if (reason.includes('verification')) return 'COMPANY_NOT_VERIFIED'
  if (reason.includes('capabilities')) return 'NO_SERVICE_CAPABILITIES'
  if (reason.includes('owner')) return 'NO_ACTIVE_COMPANY_OWNER'
  if (reason.includes('subscription')) return 'COMPANY_SUBSCRIPTION_CANCELLED'
  return 'PROVIDER_NOT_FOUND'
}

export type { MatchResult, MatchCandidate, ExcludedProvider, MatchingConfig }
export { MATCHING_SCORE_VERSION }
