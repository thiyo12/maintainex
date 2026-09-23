import { PrismaClient } from '@prisma/client'
import {
  MatchingInput, MatchResult, MatchCandidate, ExcludedProvider,
  MatchingConfig, ScoreComponents, MatchExclusionReason,
  EligibilityResult, ProviderType,
} from './types'
import { resolveMatchingConfig, DEFAULT_WEIGHTS } from './config'
import { evaluateEligibility, mapEligibilityToExclusionReason } from './eligibility'
import { scoreCandidate, getFairnessSignals, getFairnessSignalsBatch, rankCandidates } from './ranking'
import { computeTotalScore, MATCHING_SCORE_VERSION } from './scoring'
import { buildExplanationReasons } from './explanations'

const NEUTRAL_SCORE = 50

// =============================================
// BACKWARD-COMPATIBLE EXPORTS
// =============================================

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
  if (!category?.slug) return null

  let serviceTemplateSlug: string | null = null
  const templateJobIds: string[] = []

  if (serviceTemplateId) {
    const serviceTemplate = await client.serviceTemplate.findUnique({
      where: { id: serviceTemplateId },
      select: { slug: true, templateJobId: true, jobCategoryId: true },
    })
    if (!serviceTemplate || serviceTemplate.jobCategoryId !== category.id) return null

    serviceTemplateSlug = serviceTemplate.slug
    if (serviceTemplate.templateJobId) {
      const linkedTemplateJob = await client.templateJob.findUnique({
        where: { id: serviceTemplate.templateJobId },
        select: { id: true, categoryId: true },
      })
      if (!linkedTemplateJob || linkedTemplateJob.categoryId !== category.id) return null
      templateJobIds.push(linkedTemplateJob.id)
    }
  }

  if (templateJobId) {
    const directTemplateJob = await client.templateJob.findUnique({
      where: { id: templateJobId },
      select: { id: true, categoryId: true },
    })
    if (!directTemplateJob || directTemplateJob.categoryId !== category.id) return null
    if (!templateJobIds.includes(directTemplateJob.id)) templateJobIds.push(directTemplateJob.id)
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
  const normalized = providerLegacySkills.map((s) => s.toLowerCase().trim())

  if (jobReqs.serviceTemplateSlug && normalized.includes(jobReqs.serviceTemplateSlug.toLowerCase())) {
    return true
  }
  return normalized.includes(jobReqs.categorySlug.toLowerCase())
}

export function hasRelationalCapability(
  taskerJobIds: string[],
  jobReqs: JobRequirements,
): boolean {
  if (taskerJobIds.length === 0 || jobReqs.templateJobIds.length === 0) return false
  return taskerJobIds.some((id) => jobReqs.templateJobIds.includes(id))
}

export function hasCompanySpecialtyCapability(
  specialties: Array<{ categoryId: string | null; jobId: string | null }>,
  jobReqs: JobRequirements,
): boolean {
  return specialties.some((specialty) =>
    specialty.categoryId === jobReqs.categoryId ||
    (!!specialty.jobId && jobReqs.templateJobIds.includes(specialty.jobId))
  )
}

// Re-export resolveMatchingConfig from config module
export { resolveMatchingConfig }

// =============================================
// CANONICAL MATCHING ENGINE (Phase 10.2)
// =============================================

/**
 * Canonical findCandidates — uses eligibility engine + fair ranking.
 * Backward-compatible: returns same MatchResult shape.
 */
export async function findCandidates(
  client: PrismaClient,
  input: MatchingInput,
): Promise<MatchResult> {
  const config = await resolveMatchingConfig(client, input.countryCode || 'GLOBAL')
  const excluded: ExcludedProvider[] = []
  const candidates: MatchCandidate[] = []

  const job = await client.marketplaceJob.findUnique({
    where: { id: input.jobId },
    select: {
      categoryId: true, serviceTemplateId: true, templateJobId: true,
      latitude: true, longitude: true, urgency: true, countryCode: true,
    },
  })
  if (!job) return emptyResult(input.jobId, config.matchingVersion)

  const jobReqs = await resolveJobRequirements(client, job.categoryId, job.serviceTemplateId, job.templateJobId)
  if (!jobReqs) return emptyResult(input.jobId, config.matchingVersion)

  // =============================================
  // Phase 1: Collect eligible providers (eligibility evaluation)
  // =============================================
  interface EligibleIndividual {
    profile: { userId: string; rating: number | null; completedJobs: number | null; compositeScore: number | null; latitude: number | null; longitude: number | null; user: { createdAt: Date; email: string; isSuspended: boolean; isBanned: boolean } }
    eligibility: EligibilityResult
  }
  interface EligibleCompany {
    company: { id: string; userId: string; rating: number | null; completedProjects: number | null; latitude: number | null; longitude: number | null; user: { createdAt: Date; email: string; isSuspended: boolean; isBanned: boolean } }
    eligibility: EligibilityResult
  }

  const eligibleIndividuals: EligibleIndividual[] = []
  const eligibleCompanies: EligibleCompany[] = []

  // INDIVIDUAL PROVIDERS
  const individualProfiles = await client.taskerProfile.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      isVerified: true,
      user: input.countryCode ? { countryCode: input.countryCode } : undefined,
    },
    include: {
      user: { select: { id: true, email: true, isSuspended: true, isBanned: true, identityStatus: true, createdAt: true, countryCode: true } },
      taskerSkills: {
        select: {
          jobId: true,
          job: { select: { categoryId: true } },
        },
      },
    },
  })

  for (const profile of individualProfiles) {
    if (process.env.ALLOW_TEST_OTP !== 'true' && profile.user?.email.endsWith('@maintainex-test.lk')) continue
    if (!profile.user || profile.user.isSuspended || profile.user.isBanned) {
      excluded.push({
        providerId: profile.userId,
        providerType: 'INDIVIDUAL',
        reason: profile.user?.isSuspended ? 'PROVIDER_SUSPENDED' : 'PROVIDER_BANNED',
      })
      continue
    }

    const eligibility = await evaluateEligibility({
      providerType: 'INDIVIDUAL',
      providerId: profile.userId,
      job: input,
      client,
    })

    if (!eligibility.eligible) {
      const failedGate = eligibility.gates.find(g => !g.passed)
      excluded.push({
        providerId: profile.userId,
        providerType: 'INDIVIDUAL',
        reason: failedGate ? mapEligibilityToExclusionReason(failedGate) : 'CAPABILITY_MISMATCH',
        detail: failedGate?.reason || 'Eligibility check failed',
      })
      continue
    }

    eligibleIndividuals.push({ profile, eligibility })
  }

  // COMPANY PROVIDERS
  const companies = await client.companyProfile.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      isVerified: true,
      user: input.countryCode ? { countryCode: input.countryCode } : undefined,
    },
    include: {
      user: { select: { id: true, email: true, isSuspended: true, isBanned: true, countryCode: true, createdAt: true } },
      specialties: { select: { categoryId: true, jobId: true } },
    },
  })

  for (const company of companies) {
    if (process.env.ALLOW_TEST_OTP !== 'true' && company.user?.email.endsWith('@maintainex-test.lk')) continue
    if (company.user?.isSuspended) {
      excluded.push({ providerId: company.id, providerType: 'COMPANY', reason: 'COMPANY_OWNER_SUSPENDED' })
      continue
    }
    if (company.user?.isBanned) {
      excluded.push({ providerId: company.id, providerType: 'COMPANY', reason: 'COMPANY_OWNER_BANNED' })
      continue
    }

    const eligibility = await evaluateEligibility({
      providerType: 'COMPANY',
      providerId: company.id,
      job: input,
      client,
    })

    if (!eligibility.eligible) {
      const failedGate = eligibility.gates.find(g => !g.passed)
      excluded.push({
        providerId: company.id,
        providerType: 'COMPANY',
        reason: failedGate ? mapEligibilityToExclusionReason(failedGate) : 'CAPABILITY_MISMATCH',
        detail: failedGate?.reason || 'Eligibility check failed',
      })
      continue
    }

    eligibleCompanies.push({ company, eligibility })
  }

  // =============================================
  // Phase 2: Batch fairness signals (O(1) queries)
  // =============================================
  const allProviderKeys: Array<{ providerId: string; providerType: ProviderType }> = [
    ...eligibleIndividuals.map(e => ({ providerId: e.profile.userId, providerType: 'INDIVIDUAL' as const })),
    ...eligibleCompanies.map(e => ({ providerId: e.company.id, providerType: 'COMPANY' as const })),
  ]
  const fairnessBatch = await getFairnessSignalsBatch(client, allProviderKeys)

  // =============================================
  // Phase 3: Score candidates
  // =============================================
  for (const { profile, eligibility } of eligibleIndividuals) {
    const fairness = fairnessBatch.get(profile.userId) || {
      opportunitiesLast7Days: 0, opportunitiesLast30Days: 0, jobsWonLast7Days: 0,
      jobsWonLast30Days: 0, daysSinceLastOpportunity: 999, daysSinceLastCompletedJob: 999,
    }

    const components = scoreCandidate(
      {
        providerId: profile.userId,
        providerType: 'INDIVIDUAL',
        eligibility,
        profileData: {
          rating: profile.rating || 0,
          completedJobs: profile.completedJobs || 0,
          compositeScore: profile.compositeScore || 50,
          createdAt: profile.user?.createdAt || new Date(),
          latitude: profile.latitude,
          longitude: profile.longitude,
        },
        jobData: {
          latitude: job.latitude,
          longitude: job.longitude,
          urgency: (job.urgency?.toUpperCase() || 'NORMAL') as any,
        },
        fairness,
      },
      config,
    )

    candidates.push({
      providerId: profile.userId,
      providerType: 'INDIVIDUAL',
      userId: profile.userId,
      score: computeTotalScore(components, config.weights),
      rank: 0,
      scoreVersion: config.matchingVersion,
      components,
      reasons: buildExplanationReasons(components, 'INDIVIDUAL'),
    })
  }

  for (const { company, eligibility } of eligibleCompanies) {
    const fairness = fairnessBatch.get(company.id) || {
      opportunitiesLast7Days: 0, opportunitiesLast30Days: 0, jobsWonLast7Days: 0,
      jobsWonLast30Days: 0, daysSinceLastOpportunity: 999, daysSinceLastCompletedJob: 999,
    }

    const components = scoreCandidate(
      {
        providerId: company.id,
        providerType: 'COMPANY',
        eligibility,
        profileData: {
          rating: company.rating || 0,
          completedJobs: company.completedProjects || 0,
          compositeScore: 50,
          createdAt: company.user?.createdAt || new Date(),
          latitude: company.latitude,
          longitude: company.longitude,
        },
        jobData: {
          latitude: job.latitude,
          longitude: job.longitude,
          urgency: (job.urgency?.toUpperCase() || 'NORMAL') as any,
        },
        fairness,
      },
      config,
    )

    candidates.push({
      providerId: company.id,
      providerType: 'COMPANY',
      companyId: company.id,
      userId: company.userId,
      score: computeTotalScore(components, config.weights),
      rank: 0,
      scoreVersion: config.matchingVersion,
      components,
      reasons: buildExplanationReasons(components, 'COMPANY'),
    })
  }

  return {
    jobId: input.jobId,
    candidates: rankCandidates(candidates),
    excluded,
    scoreVersion: config.matchingVersion,
    generatedAt: new Date(),
  }
}

// =============================================
// NEW CANONICAL API (Phase 10.2)
// =============================================

/**
 * Evaluate a single provider's eligibility for a job.
 */
export async function evaluateTaskerEligibility(
  client: PrismaClient,
  taskerId: string,
  jobId: string,
): Promise<EligibilityResult> {
  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { categoryId: true, serviceTemplateId: true, templateJobId: true, countryCode: true },
  })
  if (!job) {
    return {
      eligible: false,
      gates: [{ gate: 'JOB_EXISTS', passed: false, reason: 'Job not found' }],
      matchedProfessionId: null, matchedSkills: [], preferredSkillsMatched: [],
      jurisdictionPassed: false, serviceAreaPassed: false, availabilityPassed: false,
    }
  }

  return evaluateEligibility({
    providerType: 'INDIVIDUAL',
    providerId: taskerId,
    job: {
      jobId,
      categoryId: job.categoryId,
      serviceTemplateId: job.serviceTemplateId || undefined,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      countryCode: job.countryCode,
    },
    client,
  })
}

/**
 * Evaluate a single company's eligibility for a job.
 */
export async function evaluateCompanyEligibility(
  client: PrismaClient,
  companyId: string,
  jobId: string,
): Promise<EligibilityResult> {
  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { categoryId: true, serviceTemplateId: true, templateJobId: true, countryCode: true },
  })
  if (!job) {
    return {
      eligible: false,
      gates: [{ gate: 'JOB_EXISTS', passed: false, reason: 'Job not found' }],
      matchedProfessionId: null, matchedSkills: [], preferredSkillsMatched: [],
      jurisdictionPassed: false, serviceAreaPassed: false, availabilityPassed: false,
    }
  }

  return evaluateEligibility({
    providerType: 'COMPANY',
    providerId: companyId,
    job: {
      jobId,
      categoryId: job.categoryId,
      serviceTemplateId: job.serviceTemplateId || undefined,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      countryCode: job.countryCode,
    },
    client,
  })
}

/**
 * Get eligible taskers for a job (pre-filtered by eligibility).
 */
export async function getEligibleTaskers(
  client: PrismaClient,
  jobId: string,
): Promise<Array<{ providerId: string; eligibility: EligibilityResult }>> {
  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { categoryId: true, serviceTemplateId: true, countryCode: true },
  })
  if (!job) return []

  const profiles = await client.taskerProfile.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      isVerified: true,
      user: job.countryCode ? { countryCode: job.countryCode } : undefined,
    },
    select: { userId: true },
  })

  const results: Array<{ providerId: string; eligibility: EligibilityResult }> = []
  for (const profile of profiles) {
    const eligibility = await evaluateEligibility({
      providerType: 'INDIVIDUAL',
      providerId: profile.userId,
      job: {
        jobId,
        categoryId: job.categoryId,
        serviceTemplateId: job.serviceTemplateId || undefined,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        countryCode: job.countryCode,
      },
      client,
    })
    if (eligibility.eligible) {
      results.push({ providerId: profile.userId, eligibility })
    }
  }
  return results
}

/**
 * Get eligible companies for a job (pre-filtered by eligibility).
 */
export async function getEligibleCompanies(
  client: PrismaClient,
  jobId: string,
): Promise<Array<{ companyId: string; eligibility: EligibilityResult }>> {
  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { categoryId: true, serviceTemplateId: true, countryCode: true },
  })
  if (!job) return []

  const companies = await client.companyProfile.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      isVerified: true,
      user: job.countryCode ? { countryCode: job.countryCode } : undefined,
    },
    select: { id: true },
  })

  const results: Array<{ companyId: string; eligibility: EligibilityResult }> = []
  for (const company of companies) {
    const eligibility = await evaluateEligibility({
      providerType: 'COMPANY',
      providerId: company.id,
      job: {
        jobId,
        categoryId: job.categoryId,
        serviceTemplateId: job.serviceTemplateId || undefined,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        countryCode: job.countryCode,
      },
      client,
    })
    if (eligibility.eligible) {
      results.push({ companyId: company.id, eligibility })
    }
  }
  return results
}

// =============================================
// HELPERS
// =============================================

function emptyResult(jobId: string, scoreVersion: string): MatchResult {
  return { jobId, candidates: [], excluded: [], scoreVersion, generatedAt: new Date() }
}

function parseSkills(skillsJson: string | null): string[] {
  if (!skillsJson || skillsJson === '[]' || skillsJson === '') return []
  try {
    const parsed = JSON.parse(skillsJson)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return [skillsJson].filter(Boolean)
  }
}

// =============================================
// RE-EXPORTS
// =============================================

export type { MatchResult, MatchCandidate, ExcludedProvider, MatchingConfig, EligibilityResult }
export { MATCHING_SCORE_VERSION }
export { evaluateEligibility, mapEligibilityToExclusionReason } from './eligibility'
export { createMatchingWave, expireOpportunities, advanceMatchingWave, respondToOpportunity, shouldStopWaves } from './waves'
