import { PrismaClient } from '@prisma/client'
import type {
  MatchCandidate,
  ScoreComponents,
  RankingInput,
  FairnessSignals,
  EligibilityResult,
  MatchingConfig,
  ProviderType,
} from './types'
import {
  computeCapabilityScore,
  computeReliabilityScore,
  computeReputationScore,
  computeAvailabilityScore,
  computeTravelScore,
  computeExperienceScore,
  computeFairnessScore,
  computePreferredSkillScore,
  computeNewProviderScore,
  computeTotalScore,
} from './scoring'

const NEUTRAL_SCORE = 50

export function rankCandidates(candidates: MatchCandidate[]): MatchCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.components.capability !== a.components.capability) {
      return b.components.capability - a.components.capability
    }
    if (b.components.reliability !== a.components.reliability) {
      return b.components.reliability - a.components.reliability
    }
    if (a.providerId < b.providerId) return -1
    if (a.providerId > b.providerId) return 1
    return 0
  })

  return sorted.map((c, i) => ({ ...c, rank: i + 1 }))
}

export function scoreCandidate(
  input: RankingInput,
  config: MatchingConfig,
): ScoreComponents {
  const { eligibility, profileData, jobData, fairness } = input

  const capability = eligibility.matchedSkills.length > 0
    ? Math.min(100, 70 + eligibility.matchedSkills.length * 5)
    : NEUTRAL_SCORE

  const reliability = computeReliabilityScore(profileData.completedJobs, 0)
  const reputation = computeReputationScore(profileData.rating, profileData.completedJobs)

  const availability = NEUTRAL_SCORE
  const travel = computeTravelScore(
    true,
    computeDistance(jobData.latitude, jobData.longitude, profileData.latitude, profileData.longitude),
    false,
  )
  const experience = computeExperienceScore(profileData.completedJobs, 0)

  const fairnessScore = computeFairnessScore(
    fairness.opportunitiesLast7Days,
    fairness.opportunitiesLast30Days,
    fairness.jobsWonLast30Days,
    fairness.daysSinceLastOpportunity,
    Math.max(fairness.opportunitiesLast30Days, 1),
  )

  const preferredSkill = computePreferredSkillScore(
    eligibility.preferredSkillsMatched.length,
    Math.max(eligibility.preferredSkillsMatched.length + (eligibility.matchedSkills.length > 0 ? 1 : 0), 1),
  )

  const newProviderBoost = computeNewProviderScore(profileData.completedJobs, config.newProviderBaseline)

  return {
    capability,
    reliability,
    reputation,
    availability,
    travel,
    experience,
    fairness: fairnessScore,
    preferredSkill,
  }
}

interface ProviderFairnessKey {
  providerId: string
  providerType: ProviderType
}

/**
 * Batch fairness signals — O(1) DB queries regardless of N providers.
 * Uses GROUP BY / aggregate queries instead of per-provider N+1.
 */
export async function getFairnessSignalsBatch(
  client: PrismaClient,
  providers: ProviderFairnessKey[],
): Promise<Map<string, FairnessSignals>> {
  if (providers.length === 0) return new Map()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const individualIds = providers.filter(p => p.providerType === 'INDIVIDUAL').map(p => p.providerId)
  const companyIds = providers.filter(p => p.providerType === 'COMPANY').map(p => p.providerId)

  // Batch 1: Opportunity counts (7d + 30d) — 2 queries
  const [opp7Rows, opp30Rows] = await Promise.all([
    client.providerOpportunity.groupBy({
      by: ['taskerId'],
      where: { taskerId: { in: individualIds }, createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
    }),
    client.providerOpportunity.groupBy({
      by: ['taskerId'],
      where: { taskerId: { in: individualIds }, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    }),
  ])

  const [opp7CompanyRows, opp30CompanyRows] = await Promise.all([
    client.providerOpportunity.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds }, createdAt: { gte: sevenDaysAgo } },
      _count: { id: true },
    }),
    client.providerOpportunity.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds }, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    }),
  ])

  // Batch 2: Jobs won (completed jobs where provider has an accepted quote) — raw SQL for cross-model join
  const [won30Rows, won7Rows] = await Promise.all([
    individualIds.length > 0
      ? client.$queryRaw<{ providerId: string; cnt: bigint }[]>`
          SELECT jq."providerId", COUNT(*) as cnt
          FROM "JobQuote" jq
          JOIN "MarketplaceJob" mj ON mj.id = jq."jobId"
          WHERE jq."providerId" IN (${individualIds.join(',')})
            AND jq.status = 'ACCEPTED'
            AND mj.status = 'COMPLETED'
            AND mj."updatedAt" >= ${thirtyDaysAgo}
          GROUP BY jq."providerId"
        `
      : Promise.resolve([]),
    individualIds.length > 0
      ? client.$queryRaw<{ providerId: string; cnt: bigint }[]>`
          SELECT jq."providerId", COUNT(*) as cnt
          FROM "JobQuote" jq
          JOIN "MarketplaceJob" mj ON mj.id = jq."jobId"
          WHERE jq."providerId" IN (${individualIds.join(',')})
            AND jq.status = 'ACCEPTED'
            AND mj.status = 'COMPLETED'
            AND mj."updatedAt" >= ${sevenDaysAgo}
          GROUP BY jq."providerId"
        `
      : Promise.resolve([]),
  ])

  const [won30CompanyRows, won7CompanyRows] = await Promise.all([
    companyIds.length > 0
      ? client.$queryRaw<{ providerId: string; cnt: bigint }[]>`
          SELECT jq."providerId", COUNT(*) as cnt
          FROM "JobQuote" jq
          JOIN "MarketplaceJob" mj ON mj.id = jq."jobId"
          WHERE jq."providerId" IN (${companyIds.join(',')})
            AND jq."providerType" = 'COMPANY'
            AND jq.status = 'ACCEPTED'
            AND mj.status = 'COMPLETED'
            AND mj."updatedAt" >= ${thirtyDaysAgo}
          GROUP BY jq."providerId"
        `
      : Promise.resolve([]),
    companyIds.length > 0
      ? client.$queryRaw<{ providerId: string; cnt: bigint }[]>`
          SELECT jq."providerId", COUNT(*) as cnt
          FROM "JobQuote" jq
          JOIN "MarketplaceJob" mj ON mj.id = jq."jobId"
          WHERE jq."providerId" IN (${companyIds.join(',')})
            AND jq."providerType" = 'COMPANY'
            AND jq.status = 'ACCEPTED'
            AND mj.status = 'COMPLETED'
            AND mj."updatedAt" >= ${sevenDaysAgo}
          GROUP BY jq."providerId"
        `
      : Promise.resolve([]),
  ])

  // Batch 3: Last opportunity + last completed job
  const [lastOppRows, lastOppCompanyRows, lastJobIndividualRows, lastJobCompanyRows] = await Promise.all([
    client.providerOpportunity.findMany({
      where: { taskerId: { in: individualIds } },
      orderBy: { createdAt: 'desc' },
      select: { taskerId: true, createdAt: true },
      distinct: ['taskerId'],
    }),
    client.providerOpportunity.findMany({
      where: { companyId: { in: companyIds } },
      orderBy: { createdAt: 'desc' },
      select: { companyId: true, createdAt: true },
      distinct: ['companyId'],
    }),
    individualIds.length > 0
      ? client.$queryRaw<{ provider_id: string; completed_at: Date }[]>`
          SELECT DISTINCT ON (jq."providerId")
            jq."providerId" as provider_id, mj."updatedAt" as completed_at
          FROM "JobQuote" jq
          JOIN "MarketplaceJob" mj ON mj.id = jq."jobId"
          WHERE jq."providerId" IN (${individualIds.join(',')})
            AND jq.status = 'ACCEPTED'
            AND mj.status = 'COMPLETED'
          ORDER BY jq."providerId", mj."updatedAt" DESC
        `
      : Promise.resolve([]),
    companyIds.length > 0
      ? client.$queryRaw<{ provider_id: string; completed_at: Date }[]>`
          SELECT DISTINCT ON (jq."providerId")
            jq."providerId" as provider_id, mj."updatedAt" as completed_at
          FROM "JobQuote" jq
          JOIN "MarketplaceJob" mj ON mj.id = jq."jobId"
          WHERE jq."providerId" IN (${companyIds.join(',')})
            AND jq."providerType" = 'COMPANY'
            AND jq.status = 'ACCEPTED'
            AND mj.status = 'COMPLETED'
          ORDER BY jq."providerId", mj."updatedAt" DESC
        `
      : Promise.resolve([]),
  ])

  // Build lookup maps
  const opp7Map = new Map<string, number>()
  for (const r of opp7Rows) { if (r.taskerId) opp7Map.set(r.taskerId, r._count.id) }
  for (const r of opp7CompanyRows) { if (r.companyId) opp7Map.set(r.companyId, r._count.id) }

  const opp30Map = new Map<string, number>()
  for (const r of opp30Rows) { if (r.taskerId) opp30Map.set(r.taskerId, r._count.id) }
  for (const r of opp30CompanyRows) { if (r.companyId) opp30Map.set(r.companyId, r._count.id) }

  const won7Map = new Map<string, number>()
  for (const r of won7Rows) won7Map.set(r.providerId, Number(r.cnt))
  for (const r of won7CompanyRows) won7Map.set(r.providerId, Number(r.cnt))

  const won30Map = new Map<string, number>()
  for (const r of won30Rows) won30Map.set(r.providerId, Number(r.cnt))
  for (const r of won30CompanyRows) won30Map.set(r.providerId, Number(r.cnt))

  const lastOppMap = new Map<string, Date>()
  for (const r of lastOppRows) { if (r.taskerId) lastOppMap.set(r.taskerId, r.createdAt) }
  for (const r of lastOppCompanyRows) { if (r.companyId) lastOppMap.set(r.companyId, r.createdAt) }

  const lastJobMap = new Map<string, Date>()
  for (const row of lastJobIndividualRows) {
    lastJobMap.set(row.provider_id, row.completed_at)
  }
  for (const row of lastJobCompanyRows) {
    lastJobMap.set(row.provider_id, row.completed_at)
  }

  // Assemble results
  const result = new Map<string, FairnessSignals>()
  for (const p of providers) {
    const lastOpp = lastOppMap.get(p.providerId)
    const daysSinceLastOpp = lastOpp
      ? Math.floor((now.getTime() - lastOpp.getTime()) / (24 * 60 * 60 * 1000))
      : 999

    const lastJob = lastJobMap.get(p.providerId)
    const daysSinceLastJob = lastJob
      ? Math.floor((now.getTime() - lastJob.getTime()) / (24 * 60 * 60 * 1000))
      : 999

    result.set(p.providerId, {
      opportunitiesLast7Days: opp7Map.get(p.providerId) || 0,
      opportunitiesLast30Days: opp30Map.get(p.providerId) || 0,
      jobsWonLast7Days: won7Map.get(p.providerId) || 0,
      jobsWonLast30Days: won30Map.get(p.providerId) || 0,
      daysSinceLastOpportunity: daysSinceLastOpp,
      daysSinceLastCompletedJob: daysSinceLastJob,
    })
  }

  return result
}

/**
 * Legacy single-provider wrapper — O(1) queries, delegates to batch.
 */
export async function getFairnessSignals(
  client: PrismaClient,
  providerId: string,
  providerType: ProviderType,
): Promise<FairnessSignals> {
  const batch = await getFairnessSignalsBatch(client, [{ providerId, providerType }])
  return batch.get(providerId) || {
    opportunitiesLast7Days: 0,
    opportunitiesLast30Days: 0,
    jobsWonLast7Days: 0,
    jobsWonLast30Days: 0,
    daysSinceLastOpportunity: 999,
    daysSinceLastCompletedJob: 999,
  }
}

function computeDistance(
  lat1: number | null, lng1: number | null,
  lat2: number | null, lng2: number | null,
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
