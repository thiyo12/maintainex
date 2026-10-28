import { describe, expect, it, vi } from 'vitest'

vi.mock('../api/v2-search', () => ({ v2Search: { categories: vi.fn() } }))

import { loadDiscoverySearch } from '../lib/discovery-search'

describe('loadDiscoverySearch', () => {
  it('trims the query, passes the selected market, and caps suggestions', async () => {
    const request = vi.fn().mockResolvedValue({
      categories: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, name: `Category ${i}` })),
      subServices: Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, name: `Service ${i}` })),
      correctedQuery: 'plumbing',
    })

    const result = await loadDiscoverySearch('  plumbing  ', 'CA', request)

    expect(request).toHaveBeenCalledWith('plumbing', undefined, 'CA')
    expect(result.categories).toHaveLength(4)
    expect(result.services).toHaveLength(5)
    expect(result.correctedQuery).toBe('plumbing')
    expect(result.failed).toBe(false)
  })

  it('does not call the API for queries shorter than two trimmed characters', async () => {
    const request = vi.fn()
    const result = await loadDiscoverySearch(' x ', 'LK', request)

    expect(request).not.toHaveBeenCalled()
    expect(result).toEqual({ categories: [], services: [], correctedQuery: undefined, failed: false })
  })

  it('returns an explicit failure state instead of turning an API error into an empty result', async () => {
    const request = vi.fn().mockRejectedValue(new Error('synthetic API failure'))
    const result = await loadDiscoverySearch('electrical', 'LK', request)

    expect(result.categories).toEqual([])
    expect(result.services).toEqual([])
    expect(result.failed).toBe(true)
  })
})
