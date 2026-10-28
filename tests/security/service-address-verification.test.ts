/**
 * Phase 00-03 closure: service-address verification on the job creation path.
 *
 * Locks the guarantees that keep a Canadian postal code or typed text from
 * authorising Vancouver work:
 *   - every job-creation entry point resolves the market server-side first;
 *   - Canadian access requires validated coordinates;
 *   - coordinates are checked against the City of Vancouver boundary;
 *   - a client-claimed country is advisory and never authoritative.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveMarketFromServiceAddress } from '@/lib/geography/market-engine'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

const jobsRoute = read('app/api/mobile/v2/jobs/route.ts')
const bookNowRoute = read('app/api/mobile/v2/book-now/route.ts')

describe('every job-creation entry point verifies server-side', () => {
  it('the mobile job create route resolves the market before creating', () => {
    expect(jobsRoute).toContain('resolveMarketFromServiceAddress')
    const resolveIdx = jobsRoute.indexOf('resolveMarketFromServiceAddress')
    const createIdx = jobsRoute.indexOf('marketplaceJob.create')
    expect(resolveIdx).toBeGreaterThan(-1)
    expect(createIdx).toBeGreaterThan(-1)
    expect(resolveIdx).toBeLessThan(createIdx)
  })

  it('book-now resolves before delegating to the domain function', () => {
    expect(bookNowRoute).toContain('resolveMarketFromServiceAddress')
    expect(bookNowRoute).toContain('createBookNowJob')
    expect(bookNowRoute.indexOf('resolveMarketFromServiceAddress')).toBeLessThan(
      bookNowRoute.indexOf('createBookNowJob'),
    )
  })

  it('the dev seed route cannot be used to bypass verification', () => {
    const seed = read('app/api/seed/test-data/route.ts')
    expect(seed).toContain("process.env.NODE_ENV === 'production'")
    expect(seed).toContain('SUPER_ADMIN')
  })
})

describe('a Canadian postal code alone cannot authorise Vancouver work', () => {
  const postalOnly = (postalCode: string) =>
    resolveMarketFromServiceAddress({ district: null, postalCode, claimedCountryCode: 'CA' })

  it('refuses a Vancouver postal code without coordinates', () => {
    const result = postalOnly('V6B 1A1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('ADDRESS_REQUIRES_VERIFICATION')
    }
  })

  it('refuses regardless of which Canadian postal prefix is used', () => {
    for (const postal of ['V6B 1A1', 'V5K 0A1', 'V3B 1B5', 'V8W 1A1']) {
      expect(postalOnly(postal).ok).toBe(false)
    }
  })

  it('still refuses when the caller claims Canada and supplies no postal code', () => {
    const result = resolveMarketFromServiceAddress({
      district: 'Colombo',
      claimedCountryCode: 'CA',
    })
    expect(result.ok).toBe(false)
  })
})

describe('coordinates remain the authority in Canada', () => {
  it('a Vancouver coordinate resolves to CA', () => {
    const result = resolveMarketFromServiceAddress({
      latitude: 49.2606,
      longitude: -123.1156,
      claimedCountryCode: 'CA',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('a neighbouring municipality is rejected', () => {
    const result = resolveMarketFromServiceAddress({
      latitude: 49.2599,
      longitude: -122.9011,
      claimedCountryCode: 'CA',
    })
    expect(result.ok).toBe(false)
    // Burnaby falls outside the coarse launch envelope before the municipal
    // polygon is consulted; both rejections are correct.
    if (!result.ok) {
      expect(['ADDRESS_OUTSIDE_VANCOUVER', 'ADDRESS_OUTSIDE_LAUNCH_GEOGRAPHY']).toContain(result.code)
    }
  })

  it('a client-claimed country cannot override the resolved market', () => {
    // Claiming LK while the coordinates sit inside Vancouver must not win.
    const result = resolveMarketFromServiceAddress({
      latitude: 49.2606,
      longitude: -123.1156,
      claimedCountryCode: 'LK',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('Sri Lankan postal codes keep working without coordinates', () => {
    const result = resolveMarketFromServiceAddress({ district: 'Colombo', postalCode: '00100' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('LK')
  })
})
