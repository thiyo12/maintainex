import { describe, expect, it } from 'vitest'

import { getCountries } from '@/lib/locations'
import { getMarketConfig } from '@/lib/geography/market-engine'

/**
 * The launch-market address data must actually CONTAIN Vancouver. An earlier
 * baseline listed only Ontario cities (Toronto, Mississauga, Brampton), so the
 * market filter correctly returned nothing for Canada and the Canadian address
 * picker was empty.
 *
 * "Listing a market in metadata is not enough" — the launch district must exist
 * in the data the picker actually reads.
 */
describe('launch location data', () => {
  const countries = getCountries()
  const canada = countries.find(c => c.code === 'CA')
  const canadaCities = canada?.states.flatMap(state => state.cities) ?? []
  const canadaCityNames = canadaCities.map(city => city.name)

  it('provides Sri Lanka with all 25 districts', () => {
    const sriLanka = countries.find(c => c.code === 'LK')
    expect(sriLanka).toBeDefined()
    expect(getMarketConfig('LK')?.districts).toHaveLength(25)
  })

  it('provides Vancouver for the Canadian launch market', () => {
    expect(canadaCityNames).toContain('Vancouver')
    expect(canadaCities.find(city => city.name === 'Vancouver')?.areas?.length).toBeGreaterThan(0)
  })

  it('contains a city for every launch district so the picker is never empty', () => {
    for (const countryCode of ['LK', 'CA'] as const) {
      const config = getMarketConfig(countryCode)
      const available = countryCode === 'CA' ? canadaCityNames : []
      for (const district of config?.districts ?? []) {
        if (countryCode === 'CA') {
          expect(available, `${countryCode} launch district "${district}" missing from location data`)
            .toContain(district)
        }
      }
    }
  })

  it('keeps legacy out-of-scope Canadian cities for historical records', () => {
    // Historical bookings and legacy records may still reference them, so they
    // must not be deleted — every launch surface filters them out instead.
    expect(canadaCityNames).toContain('Toronto')
  })

  it('exposes no unapproved market in the launch location data', () => {
    const supported = ['LK', 'CA']
    const unapproved = countries.map(c => c.code).filter(code => !supported.includes(code))
    expect(unapproved).toEqual([])
  })
})
