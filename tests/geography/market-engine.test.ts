import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MARKET_COUNTRY,
  LAUNCH_MARKETS,
  getMarketConfig,
  isSupportedDistrict,
  isSupportedMarket,
  resolveJobMarket,
  resolveMarketFromServiceAddress,
} from '@/lib/geography/market-engine'

/** Colombo, Sri Lanka */
const COLOMBO = { latitude: 6.9271, longitude: 79.8612 }
/** Downtown Vancouver, Canada */
const VANCOUVER = { latitude: 49.2827, longitude: -123.1207 }
/** Richmond BC — Metro Vancouver but outside municipal launch scope */
const RICHMOND_BC = { latitude: 49.1667, longitude: -123.1337 }
/** Toronto, Ontario — deliberately not enabled */
const TORONTO = { latitude: 43.6532, longitude: -79.3832 }
/** New York, USA */
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 }

describe('launch market configuration', () => {
  it('exposes exactly the two launch markets', () => {
    expect(Object.keys(LAUNCH_MARKETS).sort()).toEqual(['CA', 'LK'])
    expect(getMarketConfig('LK')?.currency).toBe('LKR')
    expect(getMarketConfig('CA')?.currency).toBe('CAD')
  })

  it('Sri Lanka exposes all 25 districts', () => {
    expect(LAUNCH_MARKETS.LK.districts).toHaveLength(25)
    expect(new Set(LAUNCH_MARKETS.LK.districts).size).toBe(25)
    expect(LAUNCH_MARKETS.LK.districts).toContain('Colombo')
    expect(LAUNCH_MARKETS.LK.districts).toContain('Jaffna')
  })

  it('Canada exposes Vancouver only', () => {
    expect(LAUNCH_MARKETS.CA.districts).toEqual(['Vancouver'])
  })

  it('rejects unsupported markets', () => {
    expect(isSupportedMarket('LK')).toBe(true)
    expect(isSupportedMarket('CA')).toBe(true)
    expect(isSupportedMarket('US')).toBe(false)
    expect(isSupportedMarket('')).toBe(false)
    expect(isSupportedMarket(null)).toBe(false)
  })

  it('validates districts per market', () => {
    expect(isSupportedDistrict('LK', 'Colombo')).toBe(true)
    expect(isSupportedDistrict('LK', 'Vancouver')).toBe(false)
    expect(isSupportedDistrict('CA', 'Vancouver')).toBe(true)
    expect(isSupportedDistrict('CA', 'Richmond')).toBe(false)
  })
})

describe('authoritative market resolution from the service address', () => {
  it('resolves Sri Lanka from Colombo coordinates', () => {
    const result = resolveMarketFromServiceAddress(COLOMBO)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.countryCode).toBe('LK')
      expect(result.source).toBe('coordinates')
    }
  })

  it('resolves Canada from Vancouver coordinates', () => {
    const result = resolveMarketFromServiceAddress(VANCOUVER)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('rejects Metro Vancouver municipalities outside the launch scope', () => {
    const result = resolveMarketFromServiceAddress(RICHMOND_BC)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ADDRESS_OUTSIDE_LAUNCH_GEOGRAPHY')
  })

  it('rejects Toronto and other non-launch cities', () => {
    for (const point of [TORONTO, NEW_YORK]) {
      const result = resolveMarketFromServiceAddress(point)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('ADDRESS_OUTSIDE_LAUNCH_GEOGRAPHY')
    }
  })

  it('never authorizes a market from a claimed country alone', () => {
    // A client claiming CA while supplying a Colombo address must stay LK.
    const result = resolveMarketFromServiceAddress({
      ...COLOMBO,
      claimedCountryCode: 'CA',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('LK')

    // A client claiming LK while supplying a Vancouver address must stay CA.
    const canada = resolveMarketFromServiceAddress({
      ...VANCOUVER,
      claimedCountryCode: 'LK',
    })
    expect(canada.ok).toBe(true)
    if (canada.ok) expect(canada.countryCode).toBe('CA')
  })

  it('cannot promote a Canadian address into Sri Lanka by any parameter', () => {
    const result = resolveMarketFromServiceAddress({
      ...VANCOUVER,
      postalCode: '00100',
      claimedCountryCode: 'LK',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('POSTAL_CODE_INVALID')
  })

  it('fails closed when no address evidence is supplied', () => {
    const result = resolveMarketFromServiceAddress({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('ADDRESS_NOT_PROVIDED')
  })

  it('falls back to postal code only when coordinates are absent', () => {
    const lk = resolveMarketFromServiceAddress({ postalCode: '00100' })
    expect(lk.ok).toBe(true)
    if (lk.ok) expect(lk.countryCode).toBe('LK')

    // Canadian postal codes are metro-wide and cannot prove Vancouver, so they
    // must never grant the Canadian market on their own.
    const ca = resolveMarketFromServiceAddress({ postalCode: 'V6B 1A1' })
    expect(ca.ok).toBe(false)
    if (!ca.ok) expect(ca.code).toBe('ADDRESS_REQUIRES_VERIFICATION')

    const bad = resolveMarketFromServiceAddress({ postalCode: 'NOT-A-CODE' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.code).toBe('ADDRESS_OUTSIDE_MARKET')
  })

  it('does not treat an unsupported claimed country as authorization', () => {
    // Claiming an unsupported country must never widen access, and a foreign
    // postal code must not resolve into a launch market.
    const result = resolveMarketFromServiceAddress({
      postalCode: 'V6B 1A1',
      claimedCountryCode: 'US',
    })
    expect(result.ok).toBe(false)

    // A Sri Lankan postal code stays in Sri Lanka even when the client claims
    // another country, because the claimed value is advisory only.
    const lk = resolveMarketFromServiceAddress({
      postalCode: '00100',
      claimedCountryCode: 'US',
    })
    expect(lk.ok).toBe(true)
    if (lk.ok) expect(lk.countryCode).toBe('LK')
  })
})

describe('stored job market authority', () => {
  it('prefers stored coordinates over a stored country code', () => {
    // Coordinates say Canada; a stale stored country code must not win.
    expect(resolveJobMarket({ ...VANCOUVER, countryCode: 'LK' })).toBe('CA')
    expect(resolveJobMarket({ ...COLOMBO, countryCode: 'CA' })).toBe('LK')
  })

  it('falls back to the stored country code when no coordinates exist', () => {
    expect(resolveJobMarket({ countryCode: 'CA' })).toBe('CA')
    expect(resolveJobMarket({ countryCode: 'LK' })).toBe('LK')
  })

  it('returns null for out-of-scope or unknown jobs', () => {
    expect(resolveJobMarket({ ...TORONTO, countryCode: 'LK' })).toBeNull()
    expect(resolveJobMarket({ countryCode: 'US' })).toBeNull()
    expect(resolveJobMarket({})).toBeNull()
  })

  it('keeps a safe default market for legacy rows', () => {
    expect(DEFAULT_MARKET_COUNTRY).toBe('LK')
  })
})