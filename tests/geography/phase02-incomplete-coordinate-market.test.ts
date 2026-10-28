import { describe, expect, it } from 'vitest'
import { requireJobMarket, resolveJobMarket, resolveMarketFromServiceAddress } from '@/lib/geography/market-engine'

describe('Phase 02 — incomplete location evidence must never authorize a market', () => {
  it('does not downgrade a Vancouver latitude plus Sri Lankan postal code to Sri Lanka', () => {
    const r = resolveMarketFromServiceAddress({
      latitude: 49.2827, postalCode: '00100', claimedCountryCode: 'LK',
    })
    expect(r).toMatchObject({ ok: false, code: 'ADDRESS_REQUIRES_VERIFICATION' })
  })

  it('does not accept longitude-only coordinates with a Sri Lankan postal code', () => {
    expect(resolveMarketFromServiceAddress({
      longitude: 79.8612, postalCode: '00100', claimedCountryCode: 'LK',
    })).toMatchObject({ ok: false, code: 'ADDRESS_REQUIRES_VERIFICATION' })
  })

  it('rejects one malformed coordinate instead of using a valid postal code', () => {
    for (const latitude of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveMarketFromServiceAddress({
        latitude, longitude: 79.8612, postalCode: '00100',
      })).toMatchObject({ ok: false, code: 'ADDRESS_REQUIRES_VERIFICATION' })
    }
  })

  it('rejects a partial stored coordinate instead of trusting the stored country', () => {
    expect(resolveJobMarket({ latitude: 49.2827, longitude: null, countryCode: 'LK' })).toBeNull()
    expect(resolveJobMarket({ latitude: null, longitude: -123.1207, countryCode: 'CA' })).toBeNull()
    expect(requireJobMarket({ latitude: 49.2827, countryCode: 'LK' })).toMatchObject({
      ok: false, code: 'JOB_MARKET_UNRESOLVED',
    })
  })

  it('rejects corrupted stored coordinates with a valid looking country', () => {
    expect(resolveJobMarket({ latitude: Number.NaN, longitude: 79.8612, countryCode: 'LK' })).toBeNull()
    expect(resolveJobMarket({ latitude: Number.POSITIVE_INFINITY, longitude: -123.1207, countryCode: 'CA' })).toBeNull()
  })

  it('preserves the historical fallback for genuinely coordinate-less jobs', () => {
    expect(resolveJobMarket({ latitude: null, longitude: null, countryCode: 'LK' })).toBe('LK')
    expect(resolveJobMarket({ countryCode: 'CA' })).toBe('CA')
    expect(resolveMarketFromServiceAddress({ postalCode: '00100' })).toMatchObject({
      ok: true, countryCode: 'LK',
    })
  })

  it('still accepts verified Colombo and Vancouver coordinate pairs', () => {
    expect(resolveMarketFromServiceAddress({ latitude: 6.9271, longitude: 79.8612 }))
      .toMatchObject({ ok: true, countryCode: 'LK' })
    expect(resolveMarketFromServiceAddress({ latitude: 49.2827, longitude: -123.1207 }))
      .toMatchObject({ ok: true, countryCode: 'CA' })
  })
})
