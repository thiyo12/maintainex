import { describe, it, expect, vi } from 'vitest'
import { getFairnessSignalsBatch, getFairnessSignals } from '@/lib/matching/ranking'

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    providerOpportunity: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as any
}

describe('Phase 10.2 — Fairness Batch Signals', () => {
  it('returns empty map for empty providers list', async () => {
    const client = mockPrisma()
    const result = await getFairnessSignalsBatch(client, [])
    expect(result.size).toBe(0)
  })

  it('returns default signals for providers with no history', async () => {
    const client = mockPrisma()
    const result = await getFairnessSignalsBatch(client, [
      { providerId: 'p1', providerType: 'INDIVIDUAL' },
      { providerId: 'p2', providerType: 'COMPANY' },
    ])
    expect(result.size).toBe(2)
    expect(result.get('p1')).toEqual({
      opportunitiesLast7Days: 0,
      opportunitiesLast30Days: 0,
      jobsWonLast7Days: 0,
      jobsWonLast30Days: 0,
      daysSinceLastOpportunity: 999,
      daysSinceLastCompletedJob: 999,
    })
  })

  it('populates opportunity counts from groupBy results', async () => {
    let groupByCall = 0
    const client = mockPrisma({
      providerOpportunity: {
        groupBy: vi.fn().mockImplementation(() => {
          groupByCall++
          if (groupByCall === 1) return Promise.resolve([{ taskerId: 'p1', _count: { id: 3 } }])
          if (groupByCall === 2) return Promise.resolve([{ taskerId: 'p1', _count: { id: 7 } }])
          return Promise.resolve([])
        }),
        findMany: vi.fn().mockResolvedValue([{ taskerId: 'p1', createdAt: new Date('2026-09-10') }]),
      },
    })
    const result = await getFairnessSignalsBatch(client, [
      { providerId: 'p1', providerType: 'INDIVIDUAL' },
    ])
    expect(result.get('p1')?.opportunitiesLast7Days).toBe(3)
    expect(result.get('p1')?.opportunitiesLast30Days).toBe(7)
  })

  it('populates last completed job from raw SQL', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    let queryRawCall = 0
    const client = mockPrisma({
      $queryRaw: vi.fn().mockImplementation(() => {
        queryRawCall++
        // Individual only: won30(1), won7(2), lastJob(3)
        if (queryRawCall === 3) return Promise.resolve([{ provider_id: 'p1', completed_at: twoDaysAgo }])
        return Promise.resolve([])
      }),
    })
    const result = await getFairnessSignalsBatch(client, [
      { providerId: 'p1', providerType: 'INDIVIDUAL' },
    ])
    expect(result.get('p1')?.daysSinceLastCompletedJob).toBe(2)
  })

  it('computes days since last opportunity correctly', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const client = mockPrisma({
      providerOpportunity: {
        groupBy: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([
          { taskerId: 'p1', createdAt: twoDaysAgo },
        ]),
      },
    })
    const result = await getFairnessSignalsBatch(client, [
      { providerId: 'p1', providerType: 'INDIVIDUAL' },
    ])
    expect(result.get('p1')?.daysSinceLastOpportunity).toBe(2)
  })

  it('getFairnessSignals wrapper works for single provider', async () => {
    const client = mockPrisma()
    const result = await getFairnessSignals(client, 'p1', 'INDIVIDUAL')
    expect(result.opportunitiesLast7Days).toBe(0)
    expect(result.daysSinceLastOpportunity).toBe(999)
  })

  it('handles mixed individual and company providers', async () => {
    const client = mockPrisma()
    const result = await getFairnessSignalsBatch(client, [
      { providerId: 'ind-1', providerType: 'INDIVIDUAL' },
      { providerId: 'comp-1', providerType: 'COMPANY' },
    ])
    expect(result.size).toBe(2)
    expect(result.has('ind-1')).toBe(true)
    expect(result.has('comp-1')).toBe(true)
  })

  it('counts company jobs won from raw SQL', async () => {
    let queryRawCall = 0
    const client = mockPrisma({
      $queryRaw: vi.fn().mockImplementation(() => {
        queryRawCall++
        // Company only: won30(1), won7(2), lastJob(3)
        if (queryRawCall === 1) return Promise.resolve([{ providerId: 'comp-1', cnt: 5n }])
        if (queryRawCall === 2) return Promise.resolve([{ providerId: 'comp-1', cnt: 2n }])
        if (queryRawCall === 3) return Promise.resolve([{ provider_id: 'comp-1', completed_at: new Date('2026-09-01') }])
        return Promise.resolve([])
      }),
    })
    const result = await getFairnessSignalsBatch(client, [
      { providerId: 'comp-1', providerType: 'COMPANY' },
    ])
    expect(result.get('comp-1')?.jobsWonLast30Days).toBe(5)
    expect(result.get('comp-1')?.jobsWonLast7Days).toBe(2)
  })
})
