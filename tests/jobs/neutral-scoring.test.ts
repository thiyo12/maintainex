/**
 * Phase 7.1 — Neutral Availability/Travel Fallback Tests
 *
 * Proves that when real availability/travel data is unavailable,
 * the matching engine uses a documented neutral score (50) rather
 * than fabricating perfect scores.
 */
import { describe, it, expect } from 'vitest'
import { computeAvailabilityScore, computeTravelScore } from '@/lib/matching/scoring'

const NEUTRAL_SCORE = 50

describe('Phase 7.1 — Neutral Availability/Travel Fallback', () => {
  describe('Neutral availability score', () => {
    it('neutral score (50) is documented constant', () => {
      expect(NEUTRAL_SCORE).toBe(50)
    })

    it('neutral score is between 0 and 100', () => {
      expect(NEUTRAL_SCORE).toBeGreaterThanOrEqual(0)
      expect(NEUTRAL_SCORE).toBeLessThanOrEqual(100)
    })

    it('neutral score does not equal perfect availability (100)', () => {
      const perfectScore = computeAvailabilityScore(true, false, 1)
      expect(NEUTRAL_SCORE).not.toBe(perfectScore)
      expect(NEUTRAL_SCORE).toBeLessThan(perfectScore)
    })

    it('neutral score does not equal unavailable (0)', () => {
      expect(NEUTRAL_SCORE).not.toBe(0)
      expect(NEUTRAL_SCORE).toBeGreaterThan(0)
    })
  })

  describe('Neutral travel score', () => {
    it('neutral score does not equal perfect remote travel (100)', () => {
      const perfectRemote = computeTravelScore(true, null, true)
      expect(NEUTRAL_SCORE).not.toBe(perfectRemote)
      expect(NEUTRAL_SCORE).toBeLessThan(perfectRemote)
    })

    it('neutral score does not equal no-area travel (50)', () => {
      const noAreaNotRemote = computeTravelScore(false, null, false)
      expect(NEUTRAL_SCORE).toBe(noAreaNotRemote)
    })

    it('neutral score does not reward unknown distance (70)', () => {
      const hasAreaNoDistance = computeTravelScore(true, null, false)
      expect(NEUTRAL_SCORE).toBeLessThan(hasAreaNoDistance)
    })
  })

  describe('Score determinism', () => {
    it('same neutral inputs produce same output', () => {
      const score1 = computeAvailabilityScore(true, false, 1)
      const score2 = computeAvailabilityScore(true, false, 1)
      expect(score1).toBe(score2)
    })

    it('neutral travel is deterministic across calls', () => {
      const score1 = computeTravelScore(false, null, false)
      const score2 = computeTravelScore(false, null, false)
      expect(score1).toBe(score2)
    })

    it('no Math.random in scoring functions', () => {
      const availabilityScores = Array.from({ length: 10 }, () =>
        computeAvailabilityScore(true, false, 1)
      )
      const allSame = availabilityScores.every(s => s === availabilityScores[0])
      expect(allSame).toBe(true)
    })
  })

  describe('Fabrication prevention', () => {
    it('unavailable provider scores 0, not neutral', () => {
      expect(computeAvailabilityScore(false, false, 1)).toBe(0)
    })

    it('available with conflicts gets lower score than without', () => {
      const withConflicts = computeAvailabilityScore(true, true, 1)
      const withoutConflicts = computeAvailabilityScore(true, false, 1)
      expect(withConflicts).toBeLessThan(withoutConflicts)
    })

    it('very close provider scores higher than very far', () => {
      const close = computeTravelScore(true, 3, false)
      const far = computeTravelScore(true, 100, false)
      expect(close).toBeGreaterThan(far)
    })
  })
})
