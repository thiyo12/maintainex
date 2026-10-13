import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { requireJobMarket } from '@/lib/geography/market-engine'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const COMMERCIAL_ROUTES = [
  'app/api/mobile/v2/quotes/route.ts',
  'app/api/mobile/v2/jobs/[id]/select-quote/route.ts',
  'app/api/mobile/v2/jobs/[id]/payment/route.ts',
]

describe('commercial operations follow the authoritative market', () => {
  it.each(COMMERCIAL_ROUTES)('%s resolves the market through the geography engine', path => {
    const code = source(path)
    expect(code).toContain("import { requireJobMarket } from '@/lib/geography/market-engine'")
    expect(code).toContain('requireJobMarket(')
    // Routes surface the guard's code rather than re-declaring it.
    expect(code).toContain('jobMarket.code')
  })

  it.each(COMMERCIAL_ROUTES)('%s no longer prices or matches on the raw stored country', path => {
    const code = source(path)
    expect(code).not.toMatch(/getCurrencyForCountry\(job\.countryCode\)/)
    expect(code).not.toMatch(/getCurrencyForCountry\(result\.job\.countryCode\)/)
    expect(code).not.toMatch(/countryCode: job\.countryCode,/)
  })

  it('quote creation matches the provider against the authoritative market', () => {
    const code = source('app/api/mobile/v2/quotes/route.ts')
    expect(code).toContain('const jobCountry = jobMarket.countryCode')
    expect(code).toContain('PROVIDER_COUNTRY_MISMATCH')
  })

  it('payment uses the authoritative market for provider + cash eligibility', () => {
    const code = source('app/api/mobile/v2/jobs/[id]/payment/route.ts')
    expect(code).toContain('const authoritativeCountryCode = jobMarket.countryCode')
    expect(code).toContain('isCashPaymentAvailableForMarket(authoritativeCountryCode, escrow.currency)')
  })
})

describe('requireJobMarket guard', () => {
  it('resolves from coordinates when present', () => {
    const result = requireJobMarket({
      countryCode: 'LK',
      latitude: 49.2827,
      longitude: -123.1207,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('rejects a job whose address is outside launch geography', () => {
    const result = requireJobMarket({
      countryCode: 'LK',
      latitude: 43.6532,
      longitude: -79.3832,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('JOB_MARKET_UNRESOLVED')
      expect(result.error).toContain('service address')
    }
  })

  it('keeps legacy coordinate-less jobs working via the stored country', () => {
    expect(requireJobMarket({ countryCode: 'LK' })).toEqual({ ok: true, countryCode: 'LK' })
    expect(requireJobMarket({ countryCode: 'CA' })).toEqual({ ok: true, countryCode: 'CA' })
  })

  it('rejects unknown stored countries', () => {
    const result = requireJobMarket({ countryCode: 'US' })
    expect(result.ok).toBe(false)
  })
})