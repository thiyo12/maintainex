/**
 * Phase 7 — Matching Engine Ranking Unit Tests
 *
 * Tests the rankCandidates function from lib/matching/ranking.ts.
 * Verifies sorting by score, tie-breaking rules, and edge cases.
 * No database dependency — pure unit tests.
 */
import { describe, it, expect } from 'vitest'
import { rankCandidates } from '@/lib/matching/ranking'
import { MatchCandidate, ScoreComponents } from '@/lib/matching/types'

function makeCandidate(overrides: Partial<MatchCandidate> & { providerId: string }): MatchCandidate {
  const defaultComponents: ScoreComponents = {
    capability: 50,
    reliability: 50,
    reputation: 50,
    availability: 50,
    travel: 50,
    experience: 50,
  }
  return {
    providerType: 'INDIVIDUAL',
    score: 50,
    rank: 0,
    scoreVersion: 'v1',
    components: defaultComponents,
    reasons: [],
    ...overrides,
  }
}

describe('Phase 7 — Matching Engine Ranking', () => {
  it('ranks by score descending', () => {
    const candidates = [
      makeCandidate({ providerId: 'a', score: 30 }),
      makeCandidate({ providerId: 'b', score: 80 }),
      makeCandidate({ providerId: 'c', score: 50 }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked.map(c => c.providerId)).toEqual(['b', 'c', 'a'])
    expect(ranked.map(c => c.rank)).toEqual([1, 2, 3])
  })

  it('tie broken by capability (higher first)', () => {
    const candidates = [
      makeCandidate({ providerId: 'a', score: 70, components: { capability: 40, reliability: 50, reputation: 50, availability: 50, travel: 50, experience: 50 } }),
      makeCandidate({ providerId: 'b', score: 70, components: { capability: 90, reliability: 50, reputation: 50, availability: 50, travel: 50, experience: 50 } }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked[0].providerId).toBe('b')
    expect(ranked[1].providerId).toBe('a')
  })

  it('tie broken by reliability if capability equal', () => {
    const candidates = [
      makeCandidate({ providerId: 'a', score: 70, components: { capability: 80, reliability: 30, reputation: 50, availability: 50, travel: 50, experience: 50 } }),
      makeCandidate({ providerId: 'b', score: 70, components: { capability: 80, reliability: 90, reputation: 50, availability: 50, travel: 50, experience: 50 } }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked[0].providerId).toBe('b')
    expect(ranked[1].providerId).toBe('a')
  })

  it('tie broken by providerId lexicographically if all components equal', () => {
    const candidates = [
      makeCandidate({ providerId: 'charlie', score: 70, components: { capability: 80, reliability: 60, reputation: 50, availability: 50, travel: 50, experience: 50 } }),
      makeCandidate({ providerId: 'alpha', score: 70, components: { capability: 80, reliability: 60, reputation: 50, availability: 50, travel: 50, experience: 50 } }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked[0].providerId).toBe('alpha')
    expect(ranked[1].providerId).toBe('charlie')
  })

  it('empty input returns empty array', () => {
    const ranked = rankCandidates([])
    expect(ranked).toEqual([])
  })

  it('single candidate gets rank 1', () => {
    const ranked = rankCandidates([
      makeCandidate({ providerId: 'solo', score: 75 }),
    ])
    expect(ranked.length).toBe(1)
    expect(ranked[0].rank).toBe(1)
    expect(ranked[0].providerId).toBe('solo')
  })

  it('does not mutate original array', () => {
    const candidates = [
      makeCandidate({ providerId: 'a', score: 30 }),
      makeCandidate({ providerId: 'b', score: 80 }),
    ]
    const originalOrder = candidates.map(c => c.providerId)
    rankCandidates(candidates)
    expect(candidates.map(c => c.providerId)).toEqual(originalOrder)
  })

  it('assigns sequential ranks 1, 2, 3...', () => {
    const candidates = [
      makeCandidate({ providerId: 'a', score: 90 }),
      makeCandidate({ providerId: 'b', score: 70 }),
      makeCandidate({ providerId: 'c', score: 50 }),
      makeCandidate({ providerId: 'd', score: 30 }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked.map(c => c.rank)).toEqual([1, 2, 3, 4])
  })

  it('handles negative scores', () => {
    const candidates = [
      makeCandidate({ providerId: 'a', score: -10 }),
      makeCandidate({ providerId: 'b', score: 50 }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked[0].providerId).toBe('b')
    expect(ranked[1].providerId).toBe('a')
  })
})
