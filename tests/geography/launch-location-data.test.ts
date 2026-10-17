import { describe, expect, it } from 'vitest'

import { getCountries } from '@/lib/locations'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
// A root Vitest run installs only web dependencies; importing the mobile
// TypeScript module makes Vite resolve Expo's separate tsconfig and fails the
// suite before tests run. Inspect its checked-in static data instead.
const mobileLocationSource = readFileSync(
  resolve(process.cwd(), 'apps/mobile/lib/locations.ts'), 'utf8',
)
function mobileCountrySection(code: 'LK' | 'CA') {
  const marker = `    code: '${code}',`
  const start = mobileLocationSource.indexOf(marker)
  if (start < 0) throw new Error(`Mobile locations missing market ${code}`)
  const nextCountry = mobileLocationSource.indexOf("\\n  {\\n    id: 'ca',", start + marker.length)
  const end = code === 'LK' ? nextCountry : mobileLocationSource.indexOf("\\n]\\n\\nexport function getCountries", start)
  if (end < 0) throw new Error(`Mobile locations missing market boundary for ${code}`)
  return mobileLocationSource.slice(start, end)
}
function mobileCityNames(code: 'LK' | 'CA') {
  return [...mobileCountrySection(code).matchAll(/^ {12}name: '([^']+)',/gm)]
    .map(match => match[1])
}

describe('launch location data', () => {
  const countries = getCountries()
  const canada = countries.find(c => c.code === 'CA')
  const canadaCities = canada?.states.flatMap(state => state.cities) ?? []
  const canadaCityNames = canadaCities.map(city => city.name)

  it('provides Sri Lanka with all 25 districts', () => {
    const expected = getMarketConfig('LK')!.districts
    expect(expected).toHaveLength(25)
    const sriLanka = countries.find(c => c.code === 'LK')
    expect(sriLanka).toBeDefined()
    for (const districtNames of [
      sriLanka!.states.flatMap(state => state.cities.map(city => city.name)),
      mobileCityNames('LK'),
    ]) {
      expect(districtNames).toHaveLength(25)
      expect(new Set(districtNames).size).toBe(25)
      expect([...districtNames].sort()).toEqual([...expected].sort())
      expect(districtNames).toContain('Mannar')
      expect(districtNames).toContain('Mullaitivu')
    }
  })

  it('provides Vancouver for the Canadian launch market in both web and mobile', () => {
    expect(canadaCityNames).toContain('Vancouver')
    expect(canadaCities.find(city => city.name === 'Vancouver')?.areas?.length).toBeGreaterThan(0)
    expect(mobileCityNames('CA')).toContain('Vancouver')
    expect(mobileCountrySection('CA')).toContain("id: 'ca-vancouver-downtown'")
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
    expect(mobileCityNames('CA')).toContain('Toronto')
  })

  it('exposes no unapproved market in the launch location data', () => {
    const supported = ['LK', 'CA']
    const unapproved = countries.map(c => c.code).filter(code => !supported.includes(code))
    expect(unapproved).toEqual([])
  })
})
