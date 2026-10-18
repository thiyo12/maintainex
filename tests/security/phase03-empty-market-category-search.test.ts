import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  categories: vi.fn(), jobs: vi.fn(), ai: vi.fn(), suggest: vi.fn(),
  popular: vi.fn(), log: vi.fn(), runtime: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobCategory: { findMany: mock.categories },
    templateJob: { findMany: mock.jobs },
  },
}))
vi.mock('@/lib/ai-search', () => ({
  aiSearch: mock.ai,
  getAutocompleteSuggestions: mock.suggest,
}))
vi.mock('@/lib/search-engine', () => ({
  logSearch: mock.log,
  getPopularSearches: mock.popular,
}))
vi.mock('@/lib/runtime/platform-runtime', () => ({ getPlatformRuntimeConfig: mock.runtime }))

async function search(params = 'country=CA&q=repair') {
  const { GET } = await import('@/app/api/mobile/v2/search/route')
  return GET(new NextRequest('http://localhost/api/mobile/v2/search?' + params))
}

describe('Phase 03 — search omits market categories with no bookable service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.runtime.mockResolvedValue({
      maintenance: { enabled: false }, channels: { mobile: true },
      catalog: { visible: true }, market: { available: true },
    })
    mock.categories.mockResolvedValue([
      { id: 'plumbing-id', slug: 'plumbing', name: 'Plumbing', countries: '["LK","CA"]' },
      { id: 'cleaning-id', slug: 'cleaning-services', name: 'Cleaning Services', countries: '["LK","CA"]' },
    ])
    mock.jobs.mockResolvedValue([
      { id: 'valid-ca-job', categoryId: 'plumbing-id', name: 'Leaking pipe repair', countries: '["CA"]', currency: 'CAD' },
      { id: 'wrong-currency', categoryId: 'cleaning-id', name: 'Home deep cleaning', countries: '["CA"]', currency: 'LKR' },
    ])
    mock.ai.mockReturnValue([
      { type: 'category', categoryId: 'cleaning-services', categoryName: 'Cleaning Services', categoryIcon: 'sparkles', categoryColor: '#000', score: 95 },
      { type: 'subService', categoryId: 'cleaning-services', categoryName: 'Cleaning Services', subServiceName: 'Home deep cleaning', score: 95 },
      { type: 'category', categoryId: 'plumbing', categoryName: 'Plumbing', categoryIcon: 'water', categoryColor: '#00f', score: 94 },
      { type: 'subService', categoryId: 'plumbing', categoryName: 'Plumbing', subServiceName: 'Leaking pipe repair', score: 94 },
    ])
    mock.suggest.mockReturnValue(['Cleaning Services', 'Home deep cleaning', 'Plumbing', 'Leaking pipe repair'])
    mock.log.mockResolvedValue(undefined)
  })

  it('omits an active category that has no active correctly priced service in Canada', async () => {
    const r = await search()
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.categories.map((c: { name: string }) => c.name)).toEqual(['Plumbing'])
    expect(b.subServices.map((s: { id: string }) => s.id)).toEqual(['valid-ca-job'])
    expect(b.totalResults).toBe(2)
  })

  it('does not suggest empty or wrong-currency categories during autocomplete', async () => {
    const r = await search('country=CA&q=repair&suggest=true')
    expect(r.status).toBe(200)
    expect((await r.json()).suggestions).toEqual(['Plumbing', 'Leaking pipe repair'])
  })

  it('does not expose a category when all its jobs are inactive or absent', async () => {
    mock.jobs.mockResolvedValue([])
    const b = await (await search()).json()
    expect(b.categories).toEqual([])
    expect(b.subServices).toEqual([])
    expect(b.totalResults).toBe(0)
  })

  it('continues to surface category and subservice in Sri Lanka with an LKR service', async () => {
    mock.jobs.mockResolvedValue([
      { id: 'lk-job', categoryId: 'plumbing-id', name: 'Leaking pipe repair', countries: '["LK"]', currency: 'LKR' },
    ])
    const b = await (await search('country=LK&q=repair')).json()
    expect(b.categories.map((c: { name: string }) => c.name)).toEqual(['Plumbing'])
    expect(b.subServices.map((s: { id: string }) => s.id)).toEqual(['lk-job'])
  })

  it('discovers a new active market-priced V2 job even without a static AI dictionary entry', async () => {
    mock.ai.mockReturnValue([])
    mock.jobs.mockResolvedValue([
      { id: 'basement-1', categoryId: 'plumbing-id', name: 'Basement waterproofing', countries: '["CA"]', currency: 'CAD' },
    ])
    const response = await search('country=CA&q=basement')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.subServices.map((j: { id: string }) => j.id)).toEqual(['basement-1'])
    expect(body.subServices[0]).toMatchObject({
      categoryId: 'plumbing-id', categoryName: 'Plumbing', name: 'Basement waterproofing',
    })
  })

  it('autocompletes market-scoped new jobs omitted from the static keyword library', async () => {
    mock.jobs.mockResolvedValue([
      { id: 'basement-1', categoryId: 'plumbing-id', name: 'Basement waterproofing', countries: '["CA"]', currency: 'CAD' },
    ])
    mock.suggest.mockReturnValue([])
    const body = await (await search('country=CA&q=basement&suggest=true')).json()
    expect(body.suggestions).toEqual(['Basement waterproofing'])
  })

  it('never exposes new jobs with foreign currency through name search or suggestions', async () => {
    mock.ai.mockReturnValue([])
    mock.jobs.mockResolvedValue([
      { id: 'wrong-currency', categoryId: 'plumbing-id', name: 'Basement waterproofing', countries: '["CA"]', currency: 'LKR' },
    ])
    const body = await (await search('country=CA&q=basement')).json()
    expect(body.subServices).toEqual([])
    const suggestions = await (await search('country=CA&q=basement&suggest=true')).json()
    expect(suggestions.suggestions).toEqual([])
  })

  it('rejects a dual-market single-currency service from discovery', async () => {
    mock.ai.mockReturnValue([])
    mock.jobs.mockResolvedValue([
      { id: 'dual', categoryId: 'plumbing-id', name: 'Basement waterproofing', countries: '["LK","CA"]', currency: 'CAD' },
    ])
    const body = await (await search('country=CA&q=basement')).json()
    expect(body.subServices).toEqual([])
    const suggestions = await (await search('country=CA&q=basement&suggest=true')).json()
    expect(suggestions.suggestions).toEqual([])
  })

  it('deduplicates the same V2 job found by AI and direct name search', async () => {
    const body = await (await search('country=CA&q=leaking pipe')).json()
    expect(body.subServices.map((j: { id: string }) => j.id)).toEqual(['valid-ca-job'])
    // The AI category hit is intentionally retained, alongside one job.
    expect(body.totalResults).toBe(2)
  })

  it('never broadens unsupported market searches to LK defaults', async () => {
    const b = await (await search('country=US&q=repair')).json()
    expect(b.categories).toEqual([])
    expect(b.subServices).toEqual([])
    expect(mock.categories).not.toHaveBeenCalled()
  })
})
