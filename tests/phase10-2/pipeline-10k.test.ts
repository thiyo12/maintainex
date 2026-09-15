import { describe, it, expect, vi } from 'vitest'
import { evaluateEligibility } from '@/lib/matching/eligibility'
import { getFairnessSignalsBatch } from '@/lib/matching/ranking'
import { rankCandidates } from '@/lib/matching/ranking'
import { scoreCandidate } from '@/lib/matching/ranking'
import { computeTotalScore } from '@/lib/matching/scoring'
import { DEFAULT_WEIGHTS } from '@/lib/matching/scoring'
import type { ProviderType, MatchingConfig, EligibilityResult, FairnessSignals } from '@/lib/matching/types'

const config: MatchingConfig = {
  countryCode: 'LK',
  matchingVersion: 'v2',
  weights: DEFAULT_WEIGHTS,
  wave1Size: 10,
  wave2Size: 15,
  wave3Size: 20,
  wave1ExpiryMinutes: 30,
  wave2ExpiryMinutes: 60,
  wave3ExpiryMinutes: 120,
  newProviderBaseline: 25,
  maxOpportunityBoost: 10,
}

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-1', isSuspended: false, isBanned: false,
        identityStatus: 'VERIFIED', isActive: true, countryCode: 'LK',
      }),
    },
    taskerProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'profile-1', verificationStatus: 'VERIFIED', isVerified: true,
        taskerSkills: [{ job: { categoryId: 'cat-1' } }],
        rating: 4.5, completedJobs: 10,
      }),
    },
    companyProfile: { findUnique: vi.fn().mockResolvedValue(null) },
    serviceProfessionRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    taskerProfession: { findMany: vi.fn().mockResolvedValue([]) },
    professionJurisdictionRequirement: { findMany: vi.fn().mockResolvedValue([]) },
    certification: { count: vi.fn().mockResolvedValue(0) },
    teamMember: { count: vi.fn().mockResolvedValue(1) },
    marketplaceJob: { count: vi.fn().mockResolvedValue(0) },
    $queryRaw: vi.fn().mockResolvedValue([{ cnt: 0n }]),
    providerOpportunity: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as any
}

describe('Phase 10.2 — 10K End-to-End Pipeline', () => {
  it('eligibility evaluates 100 providers in <500ms', async () => {
    const client = mockPrisma()
    const start = Date.now()
    const count = 100

    const promises = Array.from({ length: count }, (_, i) =>
      evaluateEligibility({
        providerType: 'INDIVIDUAL',
        providerId: `user-${i}`,
        job: {
          jobId: 'job-1',
          categoryId: 'cat-1',
          jobMode: 'QUOTE',
          urgency: 'NORMAL',
          countryCode: 'LK',
        },
        client,
      })
    )

    const results = await Promise.all(promises)
    const elapsed = Date.now() - start

    expect(results.every(r => r.eligible)).toBe(true)
    expect(elapsed).toBeLessThan(500)
  })

  it('batch fairness handles 100 providers in <100ms', async () => {
    const client = mockPrisma()
    const providers = Array.from({ length: 100 }, (_, i) => ({
      providerId: `user-${i}`,
      providerType: 'INDIVIDUAL' as ProviderType,
    }))

    const start = Date.now()
    const result = await getFairnessSignalsBatch(client, providers)
    const elapsed = Date.now() - start

    expect(result.size).toBe(100)
    expect(elapsed).toBeLessThan(100)
  })

  it('scoring + ranking handles 100 candidates in <50ms', async () => {
    const eligibility: EligibilityResult = {
      eligible: true,
      gates: [{ gate: 'PROFESSION_MATCH', passed: true }],
      matchedProfessionId: 'prof-1',
      matchedSkills: ['skill-1', 'skill-2'],
      preferredSkillsMatched: ['pref-1'],
      jurisdictionPassed: true,
      serviceAreaPassed: true,
      availabilityPassed: true,
    }

    const fairness: FairnessSignals = {
      opportunitiesLast7Days: 2,
      opportunitiesLast30Days: 8,
      jobsWonLast7Days: 1,
      jobsWonLast30Days: 3,
      daysSinceLastOpportunity: 5,
      daysSinceLastCompletedJob: 10,
    }

    const start = Date.now()
    const candidates = Array.from({ length: 100 }, (_, i) => {
      const components = scoreCandidate(
        {
          providerId: `user-${i}`,
          providerType: 'INDIVIDUAL',
          eligibility,
          profileData: {
            rating: 4.0 + (i % 10) * 0.1,
            completedJobs: i * 2,
            compositeScore: 50,
            createdAt: new Date(),
            latitude: 6.9 + (i % 10) * 0.01,
            longitude: 79.8 + (i % 10) * 0.01,
          },
          jobData: {
            latitude: 6.9271,
            longitude: 79.8612,
            urgency: 'NORMAL',
          },
          fairness,
        },
        config,
      )

      return {
        providerId: `user-${i}`,
        providerType: 'INDIVIDUAL' as ProviderType,
        userId: `user-${i}`,
        score: computeTotalScore(components, config.weights),
        rank: 0,
        scoreVersion: config.matchingVersion,
        components,
        reasons: [],
      }
    })

    const ranked = rankCandidates(candidates)
    const elapsed = Date.now() - start

    expect(ranked.length).toBe(100)
    expect(ranked[0].rank).toBe(1)
    expect(ranked.every((c, i) => c.rank === i + 1)).toBe(true)
    expect(elapsed).toBeLessThan(50)
  })

  it('full pipeline: eligibility → fairness → scoring → ranking for 100 providers', async () => {
    const client = mockPrisma()
    const providerCount = 100
    const start = Date.now()

    // Phase 1: Eligibility (parallel)
    const providers = Array.from({ length: providerCount }, (_, i) => ({
      userId: `user-${i}`,
      rating: 4.0 + (i % 10) * 0.1,
      completedJobs: i * 2,
      compositeScore: 50,
      createdAt: new Date(),
      latitude: 6.9 + (i % 10) * 0.01,
      longitude: 79.8 + (i % 10) * 0.01,
    }))

    const eligibilityResults = await Promise.all(
      providers.map(p =>
        evaluateEligibility({
          providerType: 'INDIVIDUAL',
          providerId: p.userId,
          job: { jobId: 'job-1', categoryId: 'cat-1', jobMode: 'QUOTE', urgency: 'NORMAL', countryCode: 'LK' },
          client,
        })
      )
    )

    const eligible = providers.filter((_, i) => eligibilityResults[i].eligible)
    expect(eligible.length).toBe(providerCount)

    // Phase 2: Batch fairness
    const fairnessBatch = await getFairnessSignalsBatch(
      client,
      eligible.map(p => ({ providerId: p.userId, providerType: 'INDIVIDUAL' as ProviderType }))
    )

    // Phase 3: Score + Rank
    const candidates = eligible.map((p, idx) => {
      const i = providers.indexOf(p)
      const fairness = fairnessBatch.get(p.userId) || {
        opportunitiesLast7Days: 0, opportunitiesLast30Days: 0,
        jobsWonLast7Days: 0, jobsWonLast30Days: 0,
        daysSinceLastOpportunity: 999, daysSinceLastCompletedJob: 999,
      }
      const components = scoreCandidate(
        {
          providerId: p.userId,
          providerType: 'INDIVIDUAL',
          eligibility: eligibilityResults[i],
          profileData: {
            rating: p.rating, completedJobs: p.completedJobs,
            compositeScore: p.compositeScore, createdAt: p.createdAt,
            latitude: p.latitude, longitude: p.longitude,
          },
          jobData: { latitude: 6.9271, longitude: 79.8612, urgency: 'NORMAL' },
          fairness,
        },
        config,
      )
      return {
        providerId: p.userId, providerType: 'INDIVIDUAL' as ProviderType,
        userId: p.userId, score: computeTotalScore(components, config.weights),
        rank: 0, scoreVersion: config.matchingVersion, components, reasons: [],
      }
    })

    const ranked = rankCandidates(candidates)
    const elapsed = Date.now() - start

    expect(ranked.length).toBe(providerCount)
    expect(ranked[0].rank).toBe(1)
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[99].score)
    expect(elapsed).toBeLessThan(1000)
  })
})
