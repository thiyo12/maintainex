import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const CREATE_ROUTE = 'app/api/mobile/v2/jobs/route.ts'

describe('job creation derives market from the validated service address', () => {
  it('uses the geography engine, not the raw client country value', () => {
    const route = source(CREATE_ROUTE)
    expect(route).toContain("import { resolveMarketFromServiceAddress } from '@/lib/geography/market-engine'")
    expect(route).toContain('resolveMarketFromServiceAddress({')
    expect(route).toContain('const finalCountryCode = addressResolution.countryCode')
  })

  it('passes address evidence (coordinates + postal), not the claim, as authority', () => {
    const route = source(CREATE_ROUTE)
    expect(route).toContain('latitude:')
    expect(route).toContain('longitude:')
    expect(route).toContain('postalCode:')
    expect(route).toContain('claimedCountryCode,')
  })

  it('rejects creation when the address cannot be validated in a launch market', () => {
    const route = source(CREATE_ROUTE)
    expect(route).toContain('if (!addressResolution.ok) {')
    expect(route).toContain('addressResolution.code')
  })

  it('no longer trusts a client country value to select the market', () => {
    const route = source(CREATE_ROUTE)
    // The market must not be derived from the body country value.
    expect(route).not.toMatch(/const finalCountryCode = typeof countryCode === 'string'/)
  })

  it('keeps the account-country consistency check as an additional guard', () => {
    const route = source(CREATE_ROUTE)
    expect(route).toContain('COUNTRY_MISMATCH')
    expect(route).toContain('finalCountryCode !== user.countryCode')
  })
})