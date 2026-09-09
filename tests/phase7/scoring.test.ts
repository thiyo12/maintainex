/**
 * Phase 7 — Matching Engine Scoring Unit Tests
 *
 * Tests all scoring functions from lib/matching/scoring.ts.
 * These are pure unit tests with no database dependency.
 * Covers: capability, reliability, reputation, availability, travel,
 * experience, total score computation, and weight validation.
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  validateWeights,
  computeCapabilityScore,
  computeReliabilityScore,
  computeReputationScore,
  computeAvailabilityScore,
  computeTravelScore,
  computeExperienceScore,
  computeTotalScore,
} from '@/lib/matching/scoring'

describe('Phase 7 — Matching Engine Scoring', () => {
  describe('computeCapabilityScore', () => {
    it('exact category match returns 100', () => {
      const score = computeCapabilityScore(['plumbing', 'electrical'], 'plumbing')
      expect(score).toBe(100)
    })

    it('exact category match is case-insensitive', () => {
      const score = computeCapabilityScore(['Plumbing'], 'plumbing')
      expect(score).toBe(100)
    })

    it('partial match returns 20 (no exact match)', () => {
      const score = computeCapabilityScore(['plumb'], 'plumbing')
      expect(score).toBe(20)
    })

    it('partial match in reverse returns 20 (no exact match)', () => {
      const score = computeCapabilityScore(['plumbing services'], 'plumbing')
      expect(score).toBe(20)
    })

    it('no match returns 20', () => {
      const score = computeCapabilityScore(['electrical'], 'plumbing')
      expect(score).toBe(20)
    })

    it('empty skills returns 0', () => {
      const score = computeCapabilityScore([], 'plumbing')
      expect(score).toBe(0)
    })

    it('service template match returns 100', () => {
      const score = computeCapabilityScore(['tpl-abc'], 'plumbing', 'tpl-abc')
      expect(score).toBe(100)
    })

    it('service template with category fallback returns 70', () => {
      const score = computeCapabilityScore(['plumbing'], 'plumbing', 'tpl-abc')
      expect(score).toBe(70)
    })

    it('service template with no match returns 30', () => {
      const score = computeCapabilityScore(['electrical'], 'plumbing', 'tpl-abc')
      expect(score).toBe(30)
    })
  })

  describe('computeReliabilityScore', () => {
    it('zero completed jobs returns 50', () => {
      const score = computeReliabilityScore(0, 0)
      expect(score).toBe(50)
    })

    it('high completion with zero cancellation returns high score', () => {
      const score = computeReliabilityScore(50, 0)
      expect(score).toBeGreaterThanOrEqual(80)
    })

    it('high cancellation rate returns low score', () => {
      const score = computeReliabilityScore(10, 0.8)
      expect(score).toBeLessThan(40)
    })

    it('volume score caps at 100 for completed jobs >= 50', () => {
      const score50 = computeReliabilityScore(50, 0)
      const score100 = computeReliabilityScore(100, 0)
      expect(score50).toBe(score100)
    })

    it('half cancellation reduces score significantly', () => {
      const full = computeReliabilityScore(20, 0)
      const half = computeReliabilityScore(20, 0.5)
      expect(half).toBeLessThan(full)
    })
  })

  describe('computeReputationScore', () => {
    it('zero reviews returns 50', () => {
      const score = computeReputationScore(0, 0)
      expect(score).toBe(50)
    })

    it('5-star with 10 reviews returns high score', () => {
      const score = computeReputationScore(5, 10)
      expect(score).toBeGreaterThanOrEqual(80)
    })

    it('1-star with reviews returns low score', () => {
      const score = computeReputationScore(1, 5)
      expect(score).toBeLessThan(40)
    })

    it('confidence bonus caps at 20', () => {
      const score10 = computeReputationScore(4, 10)
      const score20 = computeReputationScore(4, 20)
      expect(score10).toBe(score20)
    })

    it('3-star with few reviews is moderate', () => {
      const score = computeReputationScore(3, 2)
      expect(score).toBeGreaterThanOrEqual(40)
      expect(score).toBeLessThanOrEqual(70)
    })
  })

  describe('computeAvailabilityScore', () => {
    it('unavailable returns 0', () => {
      const score = computeAvailabilityScore(false, false, 1)
      expect(score).toBe(0)
    })

    it('available with no conflicts and high response rate returns 80+', () => {
      const score = computeAvailabilityScore(true, false, 1)
      expect(score).toBeGreaterThanOrEqual(80)
    })

    it('available with conflicts returns less than available without conflicts', () => {
      const withConflicts = computeAvailabilityScore(true, true, 1)
      const withoutConflicts = computeAvailabilityScore(true, false, 1)
      expect(withConflicts).toBeGreaterThanOrEqual(60)
      expect(withConflicts).toBeLessThan(withoutConflicts)
    })

    it('available with low response rate reduces score', () => {
      const high = computeAvailabilityScore(true, false, 1)
      const low = computeAvailabilityScore(true, false, 0)
      expect(low).toBeLessThan(high)
    })

    it('score caps at 100', () => {
      const score = computeAvailabilityScore(true, false, 1)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('computeTravelScore', () => {
    it('remote job returns 100', () => {
      const score = computeTravelScore(true, 50, true)
      expect(score).toBe(100)
    })

    it('no service area returns 50', () => {
      const score = computeTravelScore(false, 10, false)
      expect(score).toBe(50)
    })

    it('null distance returns 70', () => {
      const score = computeTravelScore(true, null, false)
      expect(score).toBe(70)
    })

    it('distance <= 5km returns 100', () => {
      expect(computeTravelScore(true, 0, false)).toBe(100)
      expect(computeTravelScore(true, 3, false)).toBe(100)
      expect(computeTravelScore(true, 5, false)).toBe(100)
    })

    it('distance <= 10km returns 85', () => {
      expect(computeTravelScore(true, 6, false)).toBe(85)
      expect(computeTravelScore(true, 10, false)).toBe(85)
    })

    it('distance <= 20km returns 70', () => {
      expect(computeTravelScore(true, 11, false)).toBe(70)
      expect(computeTravelScore(true, 20, false)).toBe(70)
    })

    it('distance <= 50km returns 50', () => {
      expect(computeTravelScore(true, 21, false)).toBe(50)
      expect(computeTravelScore(true, 50, false)).toBe(50)
    })

    it('distance > 50km returns 20', () => {
      expect(computeTravelScore(true, 51, false)).toBe(20)
      expect(computeTravelScore(true, 100, false)).toBe(20)
    })
  })

  describe('computeExperienceScore', () => {
    it('zero jobs and zero years returns 0', () => {
      const score = computeExperienceScore(0, 0)
      expect(score).toBe(0)
    })

    it('many jobs with years returns high score', () => {
      const score = computeExperienceScore(20, 5)
      expect(score).toBeGreaterThanOrEqual(80)
    })

    it('job score caps at 60', () => {
      const score30 = computeExperienceScore(20, 0)
      const score50 = computeExperienceScore(50, 0)
      expect(score30).toBe(score50)
    })

    it('time score caps at 40', () => {
      const score5 = computeExperienceScore(0, 5)
      const score10 = computeExperienceScore(0, 10)
      expect(score5).toBe(score10)
    })

    it('some jobs and some years is moderate', () => {
      const score = computeExperienceScore(5, 2)
      expect(score).toBeGreaterThanOrEqual(30)
      expect(score).toBeLessThanOrEqual(70)
    })
  })

  describe('computeTotalScore', () => {
    it('weighted sum is correct with default weights', () => {
      const components = {
        capability: 100,
        reliability: 100,
        reputation: 100,
        availability: 100,
        travel: 100,
        experience: 100,
      }
      const total = computeTotalScore(components, DEFAULT_WEIGHTS)
      expect(total).toBe(100)
    })

    it('all zeros returns 0', () => {
      const components = {
        capability: 0,
        reliability: 0,
        reputation: 0,
        availability: 0,
        travel: 0,
        experience: 0,
      }
      const total = computeTotalScore(components, DEFAULT_WEIGHTS)
      expect(total).toBe(0)
    })

    it('only capability weight contributes correctly', () => {
      const components = {
        capability: 100,
        reliability: 0,
        reputation: 0,
        availability: 0,
        travel: 0,
        experience: 0,
      }
      const total = computeTotalScore(components, { capability: 30, reliability: 0, reputation: 0, availability: 0, travel: 0, experience: 0 })
      expect(total).toBe(30)
    })

    it('rounds to nearest integer', () => {
      const components = {
        capability: 50,
        reliability: 0,
        reputation: 0,
        availability: 0,
        travel: 0,
        experience: 0,
      }
      const total = computeTotalScore(components, { capability: 30, reliability: 0, reputation: 0, availability: 0, travel: 0, experience: 0 })
      expect(total).toBe(15)
    })
  })

  describe('validateWeights', () => {
    it('sum=100 with valid values returns true', () => {
      expect(validateWeights(DEFAULT_WEIGHTS)).toBe(true)
    })

    it('sum!=100 returns false', () => {
      const bad = { capability: 30, reliability: 20, reputation: 20, availability: 15, travel: 10, experience: 10 }
      expect(validateWeights(bad)).toBe(false)
    })

    it('sum=101 returns false', () => {
      const bad = { capability: 31, reliability: 20, reputation: 20, availability: 15, travel: 10, experience: 5 }
      expect(validateWeights(bad)).toBe(false)
    })

    it('negative weight returns false', () => {
      const bad = { ...DEFAULT_WEIGHTS, capability: -1 }
      expect(validateWeights(bad)).toBe(false)
    })

    it('weight > 100 returns false', () => {
      const bad = { ...DEFAULT_WEIGHTS, capability: 101 }
      expect(validateWeights(bad)).toBe(false)
    })

    it('all zeros sum=0 returns false', () => {
      const zeros = { capability: 0, reliability: 0, reputation: 0, availability: 0, travel: 0, experience: 0 }
      expect(validateWeights(zeros)).toBe(false)
    })

    it('boundary weight=100 with rest=0 returns true (sum=100)', () => {
      const one = { capability: 100, reliability: 0, reputation: 0, availability: 0, travel: 0, experience: 0 }
      expect(validateWeights(one)).toBe(true)
    })

    it('valid alternative distribution returns true', () => {
      const weights = { capability: 25, reliability: 25, reputation: 25, availability: 15, travel: 5, experience: 5 }
      expect(validateWeights(weights)).toBe(true)
    })
  })
})
