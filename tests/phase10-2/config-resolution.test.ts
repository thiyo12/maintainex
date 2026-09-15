import { describe, it, expect, vi } from 'vitest'
import { resolveMatchingConfig, getWaveConfig, DEFAULT_WEIGHTS } from '@/lib/matching/config'
import { MATCHING_SCORE_VERSION } from '@/lib/matching/scoring'
import type { MatchingConfig } from '@/lib/matching/types'

const DEFAULT_CONFIG: MatchingConfig = {
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

function mockPrisma(row: any = null) {
  return {
    marketConfig: {
      findUnique: vi.fn().mockResolvedValue(row),
    },
  } as any
}

describe('Phase 10.2 — Config Resolution', () => {
  describe('resolveMatchingConfig', () => {
    it('returns defaults when no config in DB', async () => {
      const client = mockPrisma(null)
      const config = await resolveMatchingConfig(client, 'GLOBAL')
      expect(config.countryCode).toBe('GLOBAL')
      expect(config.matchingVersion).toBe('v1')
      expect(config.weights).toEqual(DEFAULT_WEIGHTS)
    })

    it('loads config from DB when available', async () => {
      const client = mockPrisma({
        countryCode: 'US',
        matchingVersion: '2.0',
        weightCapability: 30,
        weightReliability: 20,
        weightReputation: 15,
        weightAvailability: 10,
        weightTravel: 10,
        weightExperience: 15,
      })
      const config = await resolveMatchingConfig(client, 'US')
      expect(config.countryCode).toBe('US')
      expect(config.matchingVersion).toBe('2.0')
      expect(config.weights.capability).toBe(30)
    })

    it('falls back to GLOBAL when country not found', async () => {
      const client = {
        marketConfig: {
          findUnique: vi.fn()
            .mockResolvedValueOnce(null) // US not found
            .mockResolvedValueOnce({     // GLOBAL found
              countryCode: 'GLOBAL',
              matchingVersion: '1.5',
              weightCapability: 25,
              weightReliability: 25,
              weightReputation: 15,
              weightAvailability: 10,
              weightTravel: 5,
              weightExperience: 20,
            }),
        },
      } as any
      const config = await resolveMatchingConfig(client, 'US')
      expect(config.matchingVersion).toBe('1.5')
    })

    it('validates weights and returns defaults if invalid', async () => {
      const client = mockPrisma({
        countryCode: 'GLOBAL',
        weightCapability: 999, // way out of range
        weightReliability: 0,
        weightReputation: 0,
        weightAvailability: 0,
        weightTravel: 0,
        weightExperience: 0,
      })
      const config = await resolveMatchingConfig(client, 'GLOBAL')
      // Should fall back to defaults since weights are invalid
      expect(config.weights).toEqual(DEFAULT_WEIGHTS)
    })
  })

  describe('getWaveConfig', () => {
    it('returns wave 1 config', () => {
      const wave1 = getWaveConfig(DEFAULT_CONFIG, 1)
      expect(wave1.size).toBe(3)
      expect(wave1.expiryMinutes).toBe(15)
    })

    it('returns wave 2 config (larger wave)', () => {
      const wave1 = getWaveConfig(DEFAULT_CONFIG, 1)
      const wave2 = getWaveConfig(DEFAULT_CONFIG, 2)
      expect(wave2.size).toBeGreaterThanOrEqual(wave1.size)
    })

    it('returns wave 3 config (largest wave)', () => {
      const wave3 = getWaveConfig(DEFAULT_CONFIG, 3)
      expect(wave3.size).toBeGreaterThanOrEqual(5)
    })
  })
})
