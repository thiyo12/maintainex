import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Phase 02 geographic enforcement is wired into every commercial surface', () => {
  it('book-now derives the market from the service address, not the client flag', () => {
    const code = source('app/api/mobile/v2/book-now/route.ts')
    expect(code).toContain('resolveMarketFromServiceAddress')
    expect(code).toContain('claimedCountryCode:')
    // The client country is passed as an advisory claim, never as the decision.
    expect(code).not.toMatch(/const requestedCountryCode = typeof countryCode/)
    expect(code).toContain('const requestedCountryCode = market.countryCode')
  })

  it('quote creation and acceptance are bound to the authoritative market', () => {
    for (const path of [
      'app/api/mobile/v2/quotes/route.ts',
      'app/api/mobile/v2/jobs/[id]/select-quote/route.ts',
    ]) {
      expect(source(path)).toContain('requireJobMarket')
    }
  })

  it('payment is bound to the authoritative market', () => {
    const code = source('app/api/mobile/v2/jobs/[id]/payment/route.ts')
    // Phase 03 aligned GET with POST on the stricter intent resolver; the
    // geography engine is still the single source of market truth.
    expect(code).toMatch(/requireJobMarket|resolvePaymentMarketForIntent/)
    expect(source('lib/finance/payments/payment-service.ts')).toContain('requireJobMarket')
    expect(code).toContain('const authoritativeCountryCode = jobMarket.countryCode')
  })

  it('refunds preserve stored amounts while resolving market identity safely', () => {
    const code = source('app/api/mobile/v2/jobs/[id]/escrow/route.ts')
    expect(code).toContain('requireJobMarket')
    // A job whose address no longer resolves must still return its amounts.
    expect(code).toMatch(/refundMarket\.ok \? refundMarket\.countryCode : job\.countryCode/)
    // Amounts are converted for display only, never recalculated.
    expect(code).toContain('minorUnitsToMajorUnits(escrow.amount, currency)')
    expect(code).not.toMatch(/escrow\.amount\s*=/)
  })

  it('the address picker never offers out-of-launch-scope Canadian cities', () => {
    const code = source('app/api/mobile/v2/locations/route.ts')
    expect(code).toContain('getMarketConfig')
    expect(code).toContain('restrictToLaunchMarket')
    // Every country in the response is passed through the launch-market filter.
    expect(code).toMatch(/\.map\(country => restrictToLaunchMarket\(country\)\)/)
  })
})
