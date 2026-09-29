import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WEIGHTS,
  validateWeights,
  computeFairnessScore,
  computePreferredSkillScore,
  computeNewProviderScore,
  computeTotalScore,
} from '@/lib/matching/scoring'
import type { ScoreComponents, MatchingConfig } from '@/lib/matching/types'
import { MATCHING_SCORE_VERSION } from '@/lib/matching/scoring'

describe('Phase 10.2 — Scoring v2 (Fairness + Preferred Skills)', () => {
  describe('computeFairnessScore', () => {
    it('returns neutral 50 when medianOpportunities is 0', () => {
      expect(computeFairnessScore(0, 0, 0, 0, 0)).toBe(50)
    })

    it('boosts under-served provider (low recent ratio)', () => {
      // 0 in last 7 days, median 4/week → recentRatio = 0 → boost +20
      const score = computeFairnessScore(0, 0, 0, 20, 16)
      expect(score).toBeGreaterThanOrEqual(70) // 50 + 20 boost + 15 time
    })

    it('penalizes heavily-served provider (high recent ratio)', () => {
      // 10 in last 7 days, median 4/week → recentRatio = 10/1 = 10 → penalty -20
      const score = computeFairnessScore(10, 40, 5, 1, 16)
      expect(score).toBeLessThanOrEqual(40) // 50 - 20
    })

    it('boosts for long time since last opportunity', () => {
      const score = computeFairnessScore(0, 0, 0, 20, 16)
      expect(score).toBeGreaterThanOrEqual(65) // 50 + 15 time boost
    })

    it('caps at 0-100 range', () => {
      const score = computeFairnessScore(0, 0, 0, 100, 1)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('computePreferredSkillScore', () => {
    it('returns 50 when no preferred skills defined', () => {
      expect(computePreferredSkillScore(0, 0)).toBe(50)
    })

    it('returns 100 when all preferred skills matched', () => {
      expect(computePreferredSkillScore(3, 3)).toBe(100)
    })

    it('returns proportional score for partial match', () => {
      const score = computePreferredSkillScore(1, 2)
      expect(score).toBe(75) // 50 + 0.5 * 50
    })

    it('returns 50 when no skills matched', () => {
      expect(computePreferredSkillScore(0, 3)).toBe(50)
    })
  })

  describe('computeNewProviderScore', () => {
    it('returns baseline for zero completed jobs', () => {
      expect(computeNewProviderScore(0, 30)).toBe(30)
    })

    it('returns 0 for more than 10 completed jobs', () => {
      expect(computeNewProviderScore(11, 30)).toBe(0)
    })

    it('decays linearly for 1-10 jobs', () => {
      const score5 = computeNewProviderScore(5, 30)
      expect(score5).toBe(15) // 30 * (1 - 5/10)
    })
  })

  describe('computeTotalScore with fairness and preferredSkill', () => {
    it('includes fairness and preferredSkill in weighted sum', () => {
      const weights: ScoreComponents = {
        capability: 25, reliability: 20, reputation: 15,
        availability: 10, travel: 10, experience: 5,
        fairness: 5, preferredSkill: 10,
      }
      const components: ScoreComponents = {
        capability: 80, reliability: 70, reputation: 60,
        availability: 50, travel: 40, experience: 90,
        fairness: 85, preferredSkill: 75,
      }
      const total = computeTotalScore(components, weights)
      expect(total).toBeGreaterThan(0)
      expect(total).toBeLessThanOrEqual(100)
    })

    it('fairness boost increases total score when weight is non-zero', () => {
      const weights: ScoreComponents = {
        capability: 25, reliability: 20, reputation: 15,
        availability: 10, travel: 10, experience: 5,
        fairness: 10, preferredSkill: 5,
      }
      const base: ScoreComponents = {
        capability: 60, reliability: 60, reputation: 60,
        availability: 60, travel: 60, experience: 60,
        fairness: 30, preferredSkill: 50,
      }
      const boosted: ScoreComponents = { ...base, fairness: 90 }
      const baseTotal = computeTotalScore(base, weights)
      const boostedTotal = computeTotalScore(boosted, weights)
      expect(boostedTotal).toBeGreaterThan(baseTotal)
    })

    it('default weights (fairness=0, preferredSkill=0) ignore those components', () => {
      const components: ScoreComponents = {
        capability: 80, reliability: 70, reputation: 60,
        availability: 50, travel: 40, experience: 90,
        fairness: 100, preferredSkill: 100,
      }
      const total = computeTotalScore(components, DEFAULT_WEIGHTS)
      // With default weights fairness=0 and preferredSkill=0, they don't contribute
      const manual = Math.round(
        (80 * 30 + 70 * 20 + 60 * 20 + 50 * 15 + 40 * 10 + 90 * 5) / 100
      )
      expect(total).toBe(manual)
    })
  })

  describe('validateWeights with new fields', () => {
    it('accepts weights summing to 100', () => {
      const weights: ScoreComponents = {
        capability: 25, reliability: 20, reputation: 15,
        availability: 10, travel: 10, experience: 10,
        fairness: 5, preferredSkill: 5,
      }
      expect(validateWeights(weights)).toBe(true)
    })

    it('rejects weights not summing to 100', () => {
      const weights: ScoreComponents = {
        capability: 50, reliability: 50, reputation: 50,
        availability: 50, travel: 50, experience: 50,
        fairness: 50, preferredSkill: 50,
      }
      expect(validateWeights(weights)).toBe(false)
    })

    it('rejects negative weights', () => {
      const weights: ScoreComponents = {
        capability: -10, reliability: 20, reputation: 15,
        availability: 10, travel: 10, experience: 10,
        fairness: 5, preferredSkill: 5,
      }
      expect(validateWeights(weights)).toBe(false)
    })
  })
})
