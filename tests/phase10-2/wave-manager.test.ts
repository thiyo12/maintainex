import { describe, it, expect, vi } from 'vitest'
import { createMatchingWave, expireOpportunities, advanceMatchingWave, shouldStopWaves, respondToOpportunity } from '@/lib/matching/waves'
import { MATCHING_SCORE_VERSION } from '@/lib/matching/scoring'
import { DEFAULT_WEIGHTS } from '@/lib/matching/config'
import type { MatchingConfig } from '@/lib/matching/types'

const config: MatchingConfig = {
  countryCode: 'GLOBAL',
  matchingVersion: MATCHING_SCORE_VERSION,
  weights: { ...DEFAULT_WEIGHTS },
  wave1Size: 3,
  wave2Size: 5,
  wave3Size: 8,
  wave1ExpiryMinutes: 15,
  wave2ExpiryMinutes: 15,
  wave3ExpiryMinutes: 30,
  newProviderBaseline: 50,
  maxOpportunityBoost: 15,
}

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    providerOpportunity: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    marketplaceJob: {
      findUnique: vi.fn().mockResolvedValue({ id: 'job-1', status: 'OPEN', currentWave: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ pushToken: 'token-123' }),
    },
    companyProfile: {
      findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' }),
    },
    ...overrides,
  } as any
}

describe('Phase 10.2 — Wave Manager', () => {
  describe('createMatchingWave', () => {
    it('creates opportunities for candidates', async () => {
      const client = mockPrisma()
      const candidates = [
        { providerId: 'p1', providerType: 'INDIVIDUAL' as const, score: 80, rank: 1, userId: 'u1' },
        { providerId: 'p2', providerType: 'INDIVIDUAL' as const, score: 70, rank: 2, userId: 'u2' },
      ]
      const result = await createMatchingWave(client, 'job-1', 1, candidates, config)
      expect(result.waveNumber).toBe(1)
      expect(result.opportunitiesCreated).toBe(2)
      expect(client.providerOpportunity.create).toHaveBeenCalledTimes(2)
    })

    it('skips duplicate opportunities (idempotent)', async () => {
      const client = mockPrisma({
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing' }), // already exists
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const candidates = [
        { providerId: 'p1', providerType: 'INDIVIDUAL' as const, score: 80, rank: 1, userId: 'u1' },
      ]
      const result = await createMatchingWave(client, 'job-1', 1, candidates, config)
      expect(result.opportunitiesCreated).toBe(0) // skipped
    })

    it('updates job wave state', async () => {
      const client = mockPrisma()
      const candidates = [
        { providerId: 'p1', providerType: 'INDIVIDUAL' as const, score: 80, rank: 1, userId: 'u1' },
      ]
      await createMatchingWave(client, 'job-1', 2, candidates, config)
      expect(client.marketplaceJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { currentWave: 2, waveSentAt: expect.any(Date) },
      })
    })
  })

  describe('expireOpportunities', () => {
    it('returns empty array when no expired opportunities', async () => {
      const client = mockPrisma()
      const result = await expireOpportunities(client)
      expect(result).toEqual([])
    })

    it('returns job IDs for expired opportunities', async () => {
      const client = mockPrisma({
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([
            { id: 'opp-1', jobId: 'job-1' },
            { id: 'opp-2', jobId: 'job-1' },
            { id: 'opp-3', jobId: 'job-2' },
          ]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await expireOpportunities(client)
      expect(result).toContain('job-1')
      expect(result).toContain('job-2')
      expect(result.length).toBe(2) // unique job IDs
    })
  })

  describe('advanceMatchingWave', () => {
    it('advances to next wave when no one accepted', async () => {
      const client = mockPrisma({
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue(null), // no accepted
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await advanceMatchingWave(client, 'job-1', config)
      expect(result.advanced).toBe(true)
      expect(result.waveNumber).toBe(1)
    })

    it('does not advance when someone accepted', async () => {
      const client = mockPrisma({
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue({ status: 'ACCEPTED' }),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await advanceMatchingWave(client, 'job-1', config)
      expect(result.advanced).toBe(false)
    })

    it('does not advance when all waves exhausted', async () => {
      const client = mockPrisma({
        marketplaceJob: {
          findUnique: vi.fn().mockResolvedValue({ id: 'job-1', status: 'OPEN', currentWave: 3 }),
          update: vi.fn().mockResolvedValue({}),
        },
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await advanceMatchingWave(client, 'job-1', config)
      expect(result.advanced).toBe(false)
    })
  })

  describe('respondToOpportunity', () => {
    it('accepts an opportunity', async () => {
      const client = mockPrisma({
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue({ id: 'opp-1', status: 'SENT' }),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await respondToOpportunity(client, 'job-1', 'p1', 'INDIVIDUAL', 'ACCEPTED')
      expect(result.success).toBe(true)
    })

    it('rejects response to expired opportunity', async () => {
      const client = mockPrisma({
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue({ id: 'opp-1', status: 'EXPIRED' }),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await respondToOpportunity(client, 'job-1', 'p1', 'INDIVIDUAL', 'ACCEPTED')
      expect(result.success).toBe(false)
      expect(result.error).toContain('expired')
    })

    it('rejects double response', async () => {
      const client = mockPrisma({
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue({ id: 'opp-1', status: 'ACCEPTED' }),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await respondToOpportunity(client, 'job-1', 'p1', 'INDIVIDUAL', 'DECLINED')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Already responded')
    })

    it('rejects response to non-existent opportunity', async () => {
      const client = mockPrisma({
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await respondToOpportunity(client, 'job-1', 'p1', 'INDIVIDUAL', 'ACCEPTED')
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('shouldStopWaves', () => {
    it('stops when job not found', async () => {
      const client = mockPrisma({
        marketplaceJob: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
        },
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await shouldStopWaves(client, 'job-1')
      expect(result.stop).toBe(true)
      expect(result.reason).toContain('not found')
    })

    it('stops when all waves exhausted', async () => {
      const client = mockPrisma({
        marketplaceJob: {
          findUnique: vi.fn().mockResolvedValue({ status: 'OPEN', currentWave: 3 }),
          update: vi.fn().mockResolvedValue({}),
        },
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await shouldStopWaves(client, 'job-1')
      expect(result.stop).toBe(true)
      expect(result.reason).toContain('exhausted')
    })

    it('stops when provider accepted', async () => {
      const client = mockPrisma({
        marketplaceJob: {
          findUnique: vi.fn().mockResolvedValue({ status: 'OPEN', currentWave: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue({ status: 'ACCEPTED' }),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await shouldStopWaves(client, 'job-1')
      expect(result.stop).toBe(true)
      expect(result.reason).toContain('accepted')
    })

    it('does not stop for open job with waves remaining', async () => {
      const client = mockPrisma({
        marketplaceJob: {
          findUnique: vi.fn().mockResolvedValue({ status: 'OPEN', currentWave: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
        providerOpportunity: {
          findFirst: vi.fn().mockResolvedValue(null), // no accepted
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
        },
      })
      const result = await shouldStopWaves(client, 'job-1')
      expect(result.stop).toBe(false)
    })
  })
})
