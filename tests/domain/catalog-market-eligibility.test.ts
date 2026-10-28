import { describe, expect, it } from 'vitest'
import { isCatalogAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'

describe('canonical V2 catalogue market eligibility', () => {
  it('allows the requested market in a valid stored country list', () => {
    expect(isCatalogAvailableInMarket('["LK","CA"]', 'LK')).toBe(true)
    expect(isCatalogAvailableInMarket('["LK","CA"]', 'CA')).toBe(true)
  })
  it('keeps country-restricted jobs out of foreign search', () => {
    expect(isCatalogAvailableInMarket('["LK"]', 'CA')).toBe(false)
    expect(isCatalogAvailableInMarket('["CA"]', 'LK')).toBe(false)
  })
  it('fails closed on corrupt or wrongly shaped grants', () => {
    for (const raw of ['', 'LK', 'null', '{}', '"LK"', '[null,"LK"]', '[123,"CA"]']) {
      expect(isCatalogAvailableInMarket(raw, 'LK')).toBe(false)
      expect(isCatalogAvailableInMarket(raw, 'CA')).toBe(false)
    }
  })
  it('does not allow GLOBAL or another country as a launch market grant', () => {
    expect(isCatalogAvailableInMarket('["GLOBAL"]', 'LK')).toBe(false)
    expect(isCatalogAvailableInMarket('["DE"]', 'CA')).toBe(false)
  })
})
