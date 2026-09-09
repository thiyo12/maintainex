import { PrismaClient } from '@prisma/client'
import { checkIndividualProviderEligibility, checkCompanyEligibility } from '@/lib/phase6/provider-eligibility'
import {
  MatchingInput, MatchResult, MatchCandidate, ExcludedProvider,
  ProviderType, MatchingConfig, ScoreComponents, MatchExclusionReason,
} from './types'
import {
  DEFAULT_WEIGHTS, MATCHING_SCORE_VERSION, validateWeights,
  computeCapabilityScore, computeReliabilityScore, computeReputationScore,
  computeExperienceScore,
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

export interface JobRequirements {
  categorySlug: string
  categoryId: string
  templateJobIds: string[]
  serviceTemplateSlug: string | null
}

export async function resolveJobRequirements(
  client: PrismaClient,
  categoryId: string,
  serviceTemplateId?: string | null,
  templateJobId?: string | null,
): Promise<JobRequirements | null> {
  const category = await client.jobCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, slug: true },
  })
  if (!category || !category.slug) return null

  let serviceTemplateSlug: string | null = null
  const templateJobIds: string[] = []

  if (serviceTemplateId) {
    const st = await (client as any).serviceTemplate.findUnique({
      where: { id: serviceTemplateId },
      select: { slug: true, templateJobId: true, jobCategoryId: true },
    })
    if (st) {
      serviceTemplateSlug = st.slug
      if (st.templateJobId) templateJobIds.push(st.templateJobId)
    }
  }

  if (templateJobId && !templateJobIds.includes(templateJobId)) {
    templateJobIds.push(templateJobId)
  }

  return {
    categorySlug: category.slug,
    categoryId: category.id,
    templateJobIds,
    serviceTemplateSlug,
  }
}

export function hasCapabilityMatch(
  providerLegacySkills: string[],
  jobReqs: JobRequirements,
): boolean {
  if (providerLegacySkills.length === 0) return false
  const normalized = providerLegacySkills.map(s => s.toLowerCase().trim())

  if (jobReqs.serviceTemplateSlug) {
    if (normalized.includes(jobReqs.serviceTemplateSlug.toLowerCase())) return true
  }

  if (normalized.includes(jobReqs.categorySlug.toLowerCase())) return true

  return false
}

export function hasRelationalCapability(
  taskerJobIds: string[],
  jobReqs: JobRequirements,
): boolean {
  if (taskerJobIds.length === 0) return false
  if (jobReqs.templateJobIds.length === 0) return false
  return taskerJobIds.some(id => jobReqs.templateJobIds.includes(id))
}

export function hasCompanySpecialtyCapability(
  specialties: Array<{ categoryId: string | null; jobId: string | null }>,
  jobReqs: JobRequirements,
): boolean {
  return specialties.some(sp => {
    if (sp.categoryId && sp.categoryId === jobReqs.categoryId) return true
    if (sp.jobId && jobReqs.templateJobIds.includes(sp.jobId)) return true
    return false
  })
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
    select: { categoryId: true, serviceTemplateId: true, templateJobId: true, customerId: true },
  })
  if (!job) {
    return { jobId: input.jobId, candidates: [], excluded: [], scoreVersion: config.matchingVersion, generatedAt: new Date() }
  }

  const jobReqs = await resolveJobRequirements(client, job.categoryId, job.serviceTemplateId, job.templateJobId)
  if (!jobReqs) {
    return { jobId: input.jobId, candidates: [], excluded: [], scoreVersion: config.matchingVersion, generatedAt: new Date() }
  }

  const individualProfiles = await client.taskerProfile.findMany({
    where: { verificationStatus: 'VERIFIED', isVerified: true },
    include: {
      user: { select: { id: true, isSuspended: true, isBanned: true, identityStatus: true, createdAt: true } },
      taskerSkills: { select: { jobId: true } },
    },
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

    const legacySkills = parseSkills(profile.skills)
    const relationalJobIds = profile.taskerSkills.map((ts: { jobId: string }) => ts.jobId)
    const hasRelational = hasRelationalCapability(relationalJobIds, jobReqs)
    const hasLegacy = hasCapabilityMatch(legacySkills, jobReqs)

    if (!hasRelational && !hasLegacy) {
      excluded.push({
        providerId: profile.userId,
        providerType: 'INDIVIDUAL',
        reason: 'CAPABILITY_MISMATCH',
        detail: `Provider skills [${legacySkills.join(', ')}] do not match job category slug=${jobReqs.categorySlug}`,
      })
      continue
    }

    const components = scoreIndividual(profile, jobReqs, input)
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
    include: {
      user: { select: { id: true, isSuspended: true, isBanned: true } },
      specialties: { select: { categoryId: true, jobId: true } },
    },
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

    const legacyServices = parseSkills(company.services)
    const hasSpecialty = hasCompanySpecialtyCapability(company.specialties, jobReqs)
    const hasLegacy = hasCapabilityMatch(legacyServices, jobReqs)

    if (!hasSpecialty && !hasLegacy) {
      excluded.push({
        providerId: company.id,
        providerType: 'COMPANY',
        reason: 'CAPABILITY_MISMATCH',
        detail: `Company services [${legacyServices.join(', ')}] do not match job category slug=${jobReqs.categorySlug}`,
      })
      continue
    }

    const components = scoreCompany(company, jobReqs, input)
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
  jobReqs: JobRequirements,
  input: MatchingInput,
): ScoreComponents {
  const skills = parseSkills(profile.skills)
  const completedJobs = profile.completedJobs || 0
  const rating = profile.rating || 0
  const reviewCount = profile.completedJobs || 0

  return {
    capability: computeCapabilityScore(skills, jobReqs.categorySlug, jobReqs.serviceTemplateSlug || undefined),
    reliability: computeReliabilityScore(completedJobs, 0),
    reputation: computeReputationScore(rating, reviewCount),
    availability: NEUTRAL_SCORE,
    travel: NEUTRAL_SCORE,
    experience: computeExperienceScore(completedJobs, 0),
  }
}

function scoreCompany(
  company: any,
  jobReqs: JobRequirements,
  input: MatchingInput,
): ScoreComponents {
  const skills = parseSkills(company.services)
  const completedProjects = company.completedProjects || 0
  const rating = company.rating || 0

  return {
    capability: computeCapabilityScore(skills, jobReqs.categorySlug, jobReqs.serviceTemplateSlug || undefined),
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
