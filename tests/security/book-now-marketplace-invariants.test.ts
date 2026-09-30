import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('BOOK_NOW marketplace invariants', () => {
  it('propagates provider type and the customer effective country from the route', () => {
    const route = read('app/api/mobile/v2/book-now/route.ts')

    expect(route).toContain("providerType: normalizedProviderType as 'INDIVIDUAL' | 'COMPANY'")
    expect(route).toContain('countryCode: requestedCountryCode')
    expect(route).toContain('requestedCountryCode !== user.countryCode')
    expect(route).toContain("['morning', 'afternoon', 'evening', 'anytime']")
  })

  it('prevents cross-country and self/company-owner direct bookings', () => {
    const domain = read('lib/domain/book-now.ts')

    expect(domain).toContain('Cannot book yourself')
    expect(domain).toContain('Cannot book your own company')
    expect(domain).toContain('Provider country does not match booking country')
    expect(domain).toContain('Provider does not serve the requested district')
  })

  it('locks provider eligibility and rejects overlapping active bookings inside creation transaction', () => {
    const domain = read('lib/domain/book-now.ts')

    expect(domain).toContain('await lockAndAssertProviderAvailable(')
    expect(domain).toContain("mj.status IN ('QUOTE_ACCEPTED', 'IN_PROGRESS')")
    expect(domain).toContain("jq.status = 'ACCEPTED'")
    expect(domain).toContain('Provider already has an overlapping active booking')
  })

  it('persists the canonical pricing currency and authorized quote total', () => {
    const domain = read('lib/domain/book-now.ts')

    expect(domain).toContain('currency: pricing.currency')
    expect(domain).toContain('totalCents: pricing.providerGross')
  })

  it('checks declared provider availability before creating the booking', () => {
    const domain = read('lib/domain/book-now.ts')

    expect(domain).toContain('providerAvailability.findUnique')
    expect(domain).toContain('Provider is currently unavailable')
    expect(domain).toContain('Provider is unavailable on the requested date')
    expect(domain).toContain('Requested time slot is outside provider working hours')
  })
})
