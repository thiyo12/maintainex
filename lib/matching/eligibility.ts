import { PrismaClient } from '@prisma/client'
import type {
  EligibilityResult,
  EligibilityGate,
  ProviderType,
  MatchExclusionReason,
  MatchingInput,
} from './types'

export interface ProviderEligibilityInput {
  providerType: ProviderType
  providerId: string
  job: MatchingInput
  client: PrismaClient
}

/**
 * Canonical eligibility engine.
 * Evaluates YES/NO gates. Does NOT score.
 * Scoring is handled by ranking.ts.
 */
export async function evaluateEligibility(
  input: ProviderEligibilityInput,
): Promise<EligibilityResult> {
  const { providerType, providerId, job, client } = input
  const gates: EligibilityGate[] = []
  let matchedProfessionId: string | null = null
  let matchedSkills: string[] = []
  let preferredSkillsMatched: string[] = []

  // Gate 1: Provider exists and account is active
  if (providerType === 'INDIVIDUAL') {
    const user = await client.user.findUnique({
      where: { id: providerId },
      select: { id: true, isSuspended: true, isBanned: true, identityStatus: true, isActive: true },
    })
    if (!user) {
      gates.push({ gate: 'ACCOUNT_EXISTS', passed: false, reason: 'User not found' })
      return { eligible: false, gates, matchedProfessionId, matchedSkills, preferredSkillsMatched, jurisdictionPassed: false, serviceAreaPassed: false, availabilityPassed: false }
    }
    gates.push({ gate: 'ACCOUNT_EXISTS', passed: true })

    if (!user.isActive) {
      gates.push({ gate: 'ACCOUNT_ACTIVE', passed: false, reason: 'Account is inactive' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'ACCOUNT_ACTIVE', passed: true })

    if (user.isSuspended) {
      gates.push({ gate: 'NOT_SUSPENDED', passed: false, reason: 'Account is suspended' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'NOT_SUSPENDED', passed: true })

    if (user.isBanned) {
      gates.push({ gate: 'NOT_BANNED', passed: false, reason: 'Account is banned' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'NOT_BANNED', passed: true })

    // Gate: Identity verified
    if (user.identityStatus !== 'VERIFIED') {
      gates.push({ gate: 'IDENTITY_VERIFIED', passed: false, reason: 'Identity not verified' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'IDENTITY_VERIFIED', passed: true })

    // Gate: Provider profile exists and verified
    const profile = await client.taskerProfile.findUnique({
      where: { userId: providerId },
      select: { id: true, verificationStatus: true, isVerified: true },
    })
    if (!profile) {
      gates.push({ gate: 'PROVIDER_PROFILE', passed: false, reason: 'Provider profile not found' })
      return buildIneligibleResult(gates)
    }
    if (profile.verificationStatus !== 'VERIFIED' || !profile.isVerified) {
      gates.push({ gate: 'PROVIDER_VERIFIED', passed: false, reason: 'Provider not verified' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'PROVIDER_VERIFIED', passed: true })

    // Gate: Has APPROVED profession for this service
    const professionResult = await evaluateTaskerProfession(client, providerId, job)
    gates.push(professionResult.gate)
    if (!professionResult.gate.passed) {
      return buildIneligibleResult(gates, professionResult.matchedProfessionId, professionResult.matchedSkills)
    }
    matchedProfessionId = professionResult.matchedProfessionId
    matchedSkills = professionResult.matchedSkills
    preferredSkillsMatched = professionResult.preferredSkillsMatched

  } else {
    // COMPANY eligibility
    const company = await client.companyProfile.findUnique({
      where: { id: providerId },
      select: { id: true, userId: true, verificationStatus: true, isVerified: true, subscriptionStatus: true },
    })
    if (!company) {
      gates.push({ gate: 'COMPANY_EXISTS', passed: false, reason: 'Company not found' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'COMPANY_EXISTS', passed: true })

    // Check owner account
    const ownerUser = await client.user.findUnique({
      where: { id: company.userId },
      select: { isSuspended: true, isBanned: true },
    })
    if (ownerUser?.isSuspended) {
      gates.push({ gate: 'COMPANY_OWNER_ACTIVE', passed: false, reason: 'Company owner suspended' })
      return buildIneligibleResult(gates)
    }
    if (ownerUser?.isBanned) {
      gates.push({ gate: 'COMPANY_OWNER_ACTIVE', passed: false, reason: 'Company owner banned' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'COMPANY_OWNER_ACTIVE', passed: true })

    if (company.verificationStatus !== 'VERIFIED' || !company.isVerified) {
      gates.push({ gate: 'COMPANY_VERIFIED', passed: false, reason: 'Company not verified' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'COMPANY_VERIFIED', passed: true })

    if (company.subscriptionStatus === 'CANCELLED') {
      gates.push({ gate: 'COMPANY_SUBSCRIPTION', passed: false, reason: 'Subscription cancelled' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'COMPANY_SUBSCRIPTION', passed: true })

    const ownerCount = await client.teamMember.count({
      where: { companyId: providerId, role: 'COMPANY_OWNER', status: 'ACTIVE' },
    })
    if (ownerCount === 0) {
      gates.push({ gate: 'COMPANY_OWNER_EXISTS', passed: false, reason: 'No active company owner' })
      return buildIneligibleResult(gates)
    }
    gates.push({ gate: 'COMPANY_OWNER_EXISTS', passed: true })

    // Gate: Has APPROVED company profession for this service
    const companyProfResult = await evaluateCompanyProfession(client, providerId, job)
    gates.push(companyProfResult.gate)
    if (!companyProfResult.gate.passed) {
      return buildIneligibleResult(gates, companyProfResult.matchedProfessionId, companyProfResult.matchedSkills)
    }
    matchedProfessionId = companyProfResult.matchedProfessionId
    matchedSkills = companyProfResult.matchedSkills
    preferredSkillsMatched = companyProfResult.preferredSkillsMatched
  }

  // Gate: Jurisdiction credential requirement
  if (matchedProfessionId) {
    const jurisdictionGate = await evaluateJurisdictionCredential(client, providerType, providerId, job.countryCode, matchedProfessionId)
    gates.push(jurisdictionGate.gate)
    if (!jurisdictionGate.gate.passed) {
      return buildIneligibleResult(gates, matchedProfessionId, matchedSkills)
    }
  }

  // Gate: Service area (country match)
  const serviceAreaPassed = await evaluateServiceArea(client, providerType, providerId, job.countryCode)
  gates.push({ gate: 'SERVICE_AREA', passed: serviceAreaPassed, detail: serviceAreaPassed ? 'Country match confirmed' : 'No matching country code' })
  if (!serviceAreaPassed) {
    return buildIneligibleResult(gates, matchedProfessionId, matchedSkills)
  }

  // Gate: No blocking assignment conflict
  const conflictGate = await evaluateConflict(client, providerType, providerId, job.preferredDate)
  gates.push(conflictGate)
  if (!conflictGate.passed) {
    return buildIneligibleResult(gates, matchedProfessionId, matchedSkills)
  }

  // Gate: Quality floor
  const qualityPassed = await evaluateQualityFloor(client, providerType, providerId)
  gates.push({ gate: 'QUALITY_FLOOR', passed: qualityPassed, detail: qualityPassed ? 'Quality threshold met' : 'Quality floor not met' })

  return {
    eligible: qualityPassed,
    gates,
    matchedProfessionId,
    matchedSkills,
    preferredSkillsMatched,
    jurisdictionPassed: true,
    serviceAreaPassed,
    availabilityPassed: true,
  }
}

interface ProfessionEvaluation {
  gate: EligibilityGate
  matchedProfessionId: string | null
  matchedSkills: string[]
  preferredSkillsMatched: string[]
}

async function evaluateTaskerProfession(
  client: PrismaClient,
  taskerId: string,
  job: MatchingInput,
): Promise<ProfessionEvaluation> {
  // Get service requirements for this job
  const requirements = await client.serviceProfessionRequirement.findMany({
    where: { serviceTemplateId: job.serviceTemplateId || undefined },
    include: {
      profession: { select: { id: true, isActive: true } },
      skillRequirements: {
        include: {
          professionSkill: { select: { id: true, slug: true } },
        },
      },
    },
  })

  if (requirements.length === 0) {
    // No profession requirements configured — fall back to legacy capability check
    const profile = await client.taskerProfile.findUnique({
      where: { userId: taskerId },
      select: { id: true, skills: true, taskerSkills: { select: { jobId: true, job: { select: { categoryId: true } } } } },
    })
    if (!profile) {
      return { gate: { gate: 'PROFESSION_MATCH', passed: false, reason: 'No provider profile' }, matchedProfessionId: null, matchedSkills: [], preferredSkillsMatched: [] }
    }
    // Legacy fallback: check if any taskerSkill matches the job category
    const hasLegacy = profile.taskerSkills.some(s => s.job.categoryId === job.categoryId)
    if (hasLegacy) {
      return { gate: { gate: 'PROFESSION_MATCH', passed: true, detail: 'Legacy capability match' }, matchedProfessionId: null, matchedSkills: [], preferredSkillsMatched: [] }
    }
    return { gate: { gate: 'PROFESSION_MATCH', passed: false, reason: 'No matching capability' }, matchedProfessionId: null, matchedSkills: [], preferredSkillsMatched: [] }
  }

  // Get tasker's approved professions
  const taskerProfessions = await client.taskerProfession.findMany({
    where: { taskerProfileId: taskerId, status: 'APPROVED' },
    include: {
      profession: { select: { id: true, isActive: true } },
      skills: { select: { professionSkill: { select: { id: true, slug: true } } } },
    },
  })

  // Group requirements by alternativeGroupId
  const alternativeGroups = new Map<string | null, typeof requirements>()
  for (const req of requirements) {
    const key = req.alternativeGroupId || null
    if (!alternativeGroups.has(key)) alternativeGroups.set(key, [])
    alternativeGroups.get(key)!.push(req)
  }

  // Evaluate: ANY alternative group must be fully satisfied
  for (const [, groupReqs] of alternativeGroups) {
    const groupProfessions = groupReqs.map(r => r.professionId)
    const matched = taskerProfessions.find(tp =>
      groupProfessions.includes(tp.professionId) && tp.profession.isActive
    )
    if (!matched) continue

    // Check skill requirements for this matched profession
    const allSkillReqs = groupReqs.flatMap(r => r.skillRequirements)
    const providerSkillIds = new Set(matched.skills.map(s => s.professionSkill.id))
    const providerSkillSlugs = new Set(matched.skills.map(s => s.professionSkill.slug))

    const requiredAll = allSkillReqs.filter(sr => sr.requirementMode === 'REQUIRED_ALL')
    const requiredAny = allSkillReqs.filter(sr => sr.requirementMode === 'REQUIRED_ANY_OF')
    const preferred = allSkillReqs.filter(sr => sr.requirementMode === 'PREFERRED')

    const hasAllRequired = requiredAll.every(sr => providerSkillIds.has(sr.professionSkillId))
    const hasAnyRequired = requiredAny.length === 0 || requiredAny.some(sr => providerSkillIds.has(sr.professionSkillId))

    if (hasAllRequired && hasAnyRequired) {
      const matchedSkillsList = allSkillReqs
        .filter(sr => sr.requirementMode !== 'PREFERRED' && providerSkillIds.has(sr.professionSkillId))
        .map(sr => sr.professionSkill.slug)
      const preferredList = preferred
        .filter(sr => providerSkillIds.has(sr.professionSkillId))
        .map(sr => sr.professionSkill.slug)

      return {
        gate: { gate: 'PROFESSION_MATCH', passed: true, detail: `Matched profession: ${matched.profession.id}` },
        matchedProfessionId: matched.professionId,
        matchedSkills: matchedSkillsList,
        preferredSkillsMatched: preferredList,
      }
    }
  }

  return {
    gate: { gate: 'PROFESSION_MATCH', passed: false, reason: 'No approved profession with required skills' },
    matchedProfessionId: null,
    matchedSkills: [],
    preferredSkillsMatched: [],
  }
}

async function evaluateCompanyProfession(
  client: PrismaClient,
  companyId: string,
  job: MatchingInput,
): Promise<ProfessionEvaluation> {
  const requirements = await client.serviceProfessionRequirement.findMany({
    where: { serviceTemplateId: job.serviceTemplateId || undefined },
    include: {
      profession: { select: { id: true, isActive: true } },
      skillRequirements: {
        include: {
          professionSkill: { select: { id: true, slug: true } },
        },
      },
    },
  })

  if (requirements.length === 0) {
    // Legacy fallback
    const company = await client.companyProfile.findUnique({
      where: { id: companyId },
      select: { id: true, services: true, specialties: { select: { categoryId: true, jobId: true } } },
    })
    if (!company) {
      return { gate: { gate: 'COMPANY_PROFESSION_MATCH', passed: false, reason: 'Company not found' }, matchedProfessionId: null, matchedSkills: [], preferredSkillsMatched: [] }
    }
    const hasSpecialty = company.specialties.some(s => s.categoryId === job.categoryId)
    if (hasSpecialty) {
      return { gate: { gate: 'COMPANY_PROFESSION_MATCH', passed: true, detail: 'Legacy specialty match' }, matchedProfessionId: null, matchedSkills: [], preferredSkillsMatched: [] }
    }
    return { gate: { gate: 'COMPANY_PROFESSION_MATCH', passed: false, reason: 'No matching capability' }, matchedProfessionId: null, matchedSkills: [], preferredSkillsMatched: [] }
  }

  const companyProfessions = await client.companyProfession.findMany({
    where: { companyProfileId: companyId, status: 'APPROVED' },
    include: {
      profession: { select: { id: true, isActive: true } },
      skills: { select: { professionSkill: { select: { id: true, slug: true } } } },
    },
  })

  const alternativeGroups = new Map<string | null, typeof requirements>()
  for (const req of requirements) {
    const key = req.alternativeGroupId || null
    if (!alternativeGroups.has(key)) alternativeGroups.set(key, [])
    alternativeGroups.get(key)!.push(req)
  }

  for (const [, groupReqs] of alternativeGroups) {
    const groupProfessions = groupReqs.map(r => r.professionId)
    const matched = companyProfessions.find(cp =>
      groupProfessions.includes(cp.professionId) && cp.profession.isActive
    )
    if (!matched) continue

    const allSkillReqs = groupReqs.flatMap(r => r.skillRequirements)
    const providerSkillIds = new Set(matched.skills.map(s => s.professionSkill.id))

    const requiredAll = allSkillReqs.filter(sr => sr.requirementMode === 'REQUIRED_ALL')
    const requiredAny = allSkillReqs.filter(sr => sr.requirementMode === 'REQUIRED_ANY_OF')
    const preferred = allSkillReqs.filter(sr => sr.requirementMode === 'PREFERRED')

    const hasAllRequired = requiredAll.every(sr => providerSkillIds.has(sr.professionSkillId))
    const hasAnyRequired = requiredAny.length === 0 || requiredAny.some(sr => providerSkillIds.has(sr.professionSkillId))

    if (hasAllRequired && hasAnyRequired) {
      const matchedSkillsList = allSkillReqs
        .filter(sr => sr.requirementMode !== 'PREFERRED' && providerSkillIds.has(sr.professionSkillId))
        .map(sr => sr.professionSkill.slug)
      const preferredList = preferred
        .filter(sr => providerSkillIds.has(sr.professionSkillId))
        .map(sr => sr.professionSkill.slug)

      return {
        gate: { gate: 'COMPANY_PROFESSION_MATCH', passed: true, detail: `Matched profession: ${matched.profession.id}` },
        matchedProfessionId: matched.professionId,
        matchedSkills: matchedSkillsList,
        preferredSkillsMatched: preferredList,
      }
    }
  }

  return {
    gate: { gate: 'COMPANY_PROFESSION_MATCH', passed: false, reason: 'No approved company profession with required skills' },
    matchedProfessionId: null,
    matchedSkills: [],
    preferredSkillsMatched: [],
  }
}

function buildIneligibleResult(
  gates: EligibilityGate[],
  matchedProfessionId: string | null = null,
  matchedSkills: string[] = [],
): EligibilityResult {
  return {
    eligible: false,
    gates,
    matchedProfessionId,
    matchedSkills,
    preferredSkillsMatched: [],
    jurisdictionPassed: false,
    serviceAreaPassed: false,
    availabilityPassed: false,
  }
}

async function evaluateJurisdictionCredential(
  client: PrismaClient,
  providerType: ProviderType,
  providerId: string,
  countryCode: string | undefined,
  matchedProfessionId: string,
): Promise<{ gate: EligibilityGate }> {
  if (!countryCode) return { gate: { gate: 'JURISDICTION_CREDENTIAL', passed: true, detail: 'No jurisdiction specified' } }

  const requirements = await client.professionJurisdictionRequirement.findMany({
    where: { countryCode, professionId: matchedProfessionId, isActive: true, credentialRequired: true },
  })

  if (requirements.length === 0) return { gate: { gate: 'JURISDICTION_CREDENTIAL', passed: true, detail: 'No jurisdiction credential required' } }

  const holderType = providerType === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'COMPANY'
  const credentialTypes = requirements.map(r => r.credentialType).filter(Boolean) as string[]

  if (credentialTypes.length === 0) return { gate: { gate: 'JURISDICTION_CREDENTIAL', passed: true, detail: 'No credential type required' } }

  const validCerts = await client.certification.count({
    where: {
      holderType,
      holderId: providerId,
      certificationType: { in: credentialTypes },
      verificationStatus: 'VERIFIED',
      isActive: true,
    },
  })

  if (validCerts === 0) {
    return { gate: { gate: 'JURISDICTION_CREDENTIAL', passed: false, reason: `Missing jurisdiction credential: ${credentialTypes.join(', ')}` } }
  }
  return { gate: { gate: 'JURISDICTION_CREDENTIAL', passed: true, detail: `Has ${validCerts} jurisdiction credential(s)` } }
}

async function evaluateServiceArea(
  client: PrismaClient,
  providerType: ProviderType,
  providerId: string,
  jobCountryCode: string | undefined,
): Promise<boolean> {
  if (!jobCountryCode) return true
  if (providerType === 'INDIVIDUAL') {
    const user = await client.user.findUnique({
      where: { id: providerId },
      select: { countryCode: true },
    })
    return user?.countryCode === jobCountryCode
  }
  const company = await client.companyProfile.findUnique({
    where: { id: providerId },
    select: { user: { select: { countryCode: true } } },
  })
  return company?.user?.countryCode === jobCountryCode
}

function preferredDayKey(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

async function evaluateConflict(
  client: PrismaClient,
  providerType: ProviderType,
  providerId: string,
  preferredDate?: Date | string | null,
): Promise<EligibilityGate> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  let activeJobs: { preferredDate: Date | null }[]
  if (providerType === 'INDIVIDUAL') {
    activeJobs = await client.$queryRaw<{ preferredDate: Date | null }[]>`
      SELECT mj."preferredDate"
      FROM "MarketplaceJob" mj
      JOIN "JobQuote" jq ON jq."jobId" = mj.id
      WHERE jq."providerId" = ${providerId}
        AND jq.status = 'ACCEPTED'
        AND mj.status IN ('QUOTE_ACCEPTED', 'IN_PROGRESS')
        AND mj."createdAt" >= ${thirtyDaysAgo}
    `
  } else {
    activeJobs = await client.$queryRaw<{ preferredDate: Date | null }[]>`
      SELECT mj."preferredDate"
      FROM "MarketplaceJob" mj
      JOIN "JobQuote" jq ON jq."jobId" = mj.id
      WHERE jq."providerId" = ${providerId}
        AND jq."providerType" = 'COMPANY'
        AND jq.status = 'ACCEPTED'
        AND mj.status IN ('QUOTE_ACCEPTED', 'IN_PROGRESS')
        AND mj."createdAt" >= ${thirtyDaysAgo}
    `
  }

  if (activeJobs.length === 0) {
    return { gate: 'NO_CONFLICT', passed: true, detail: 'No active conflict' }
  }

  if (preferredDate == null) {
    return { gate: 'NO_CONFLICT', passed: false, reason: `Active job conflict: ${activeJobs.length} in-progress job(s)` }
  }

  const newJobDay = preferredDayKey(new Date(preferredDate))
  const overlapping = activeJobs.filter(
    (job) => job.preferredDate == null || preferredDayKey(new Date(job.preferredDate)) === newJobDay
  )

  if (overlapping.length > 0) {
    return {
      gate: 'NO_CONFLICT',
      passed: false,
      reason: `Active job conflict: scheduled dates overlap (${overlapping.length} of ${activeJobs.length} active job(s))`,
    }
  }

  return {
    gate: 'NO_CONFLICT',
    passed: true,
    detail: `Future scheduling allowed: no date overlap with ${activeJobs.length} active job(s)`,
  }
}

async function evaluateQualityFloor(
  client: PrismaClient,
  providerType: ProviderType,
  providerId: string,
): Promise<boolean> {
  if (providerType === 'INDIVIDUAL') {
    const profile = await client.taskerProfile.findUnique({
      where: { userId: providerId },
      select: { rating: true, completedJobs: true },
    })
    if (!profile) return false
    if (profile.completedJobs === 0) return true
    return profile.rating >= 3.0
  }
  const company = await client.companyProfile.findUnique({
    where: { id: providerId },
    select: { rating: true, completedProjects: true },
  })
  if (!company) return false
  if (company.completedProjects === 0) return true
  return company.rating >= 3.0
}

export function mapEligibilityToExclusionReason(gate: EligibilityGate): MatchExclusionReason {
  // More specific patterns first
  if (gate.reason?.includes('owner suspended')) return 'COMPANY_OWNER_SUSPENDED'
  if (gate.reason?.includes('owner banned')) return 'COMPANY_OWNER_BANNED'
  if (gate.reason?.includes('No active company owner')) return 'NO_ACTIVE_COMPANY_OWNER'
  if (gate.reason?.includes('Subscription')) return 'COMPANY_SUBSCRIPTION_CANCELLED'
  if (gate.gate === 'JURISDICTION_CREDENTIAL' && !gate.passed) return 'JURISDICTION_CREDENTIAL_REQUIRED'
  if (gate.reason?.includes('jurisdiction credential')) return 'JURISDICTION_CREDENTIAL_REQUIRED'
  if (gate.reason?.includes('Missing jurisdiction')) return 'JURISDICTION_CREDENTIAL_REQUIRED'
  if (gate.reason?.includes('Identity')) return 'IDENTITY_NOT_VERIFIED'
  if (gate.reason?.includes('not verified')) return 'PROVIDER_VERIFICATION_NOT_APPROVED'
  if (gate.gate === 'SERVICE_AREA' && !gate.passed) return 'OUTSIDE_SERVICE_AREA'
  if (gate.gate === 'NO_CONFLICT' && !gate.passed) return 'ASSIGNMENT_CONFLICT'
  if (gate.gate === 'QUALITY_FLOOR' && !gate.passed) return 'QUALITY_FLOOR'
  if (gate.reason?.includes('No matching') || gate.reason?.includes('No approved')) return 'PROFESSION_MISMATCH'
  if (gate.reason?.includes('suspended')) return 'PROVIDER_SUSPENDED'
  if (gate.reason?.includes('banned')) return 'PROVIDER_BANNED'
  if (gate.reason?.includes('not found')) return 'PROVIDER_NOT_FOUND'
  if (gate.gate === 'PROFESSION_MATCH' && !gate.passed) return 'PROFESSION_MISMATCH'
  if (gate.gate === 'COMPANY_PROFESSION_MATCH' && !gate.passed) return 'PROFESSION_MISMATCH'
  return 'CAPABILITY_MISMATCH'
}
