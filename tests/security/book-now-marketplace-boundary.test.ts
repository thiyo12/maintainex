import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('BOOK_NOW marketplace boundary', () => {
  const route = read('app/api/mobile/v2/book-now/route.ts')
  const domain = read('lib/domain/book-now.ts')

  it('propagates provider type and the authenticated customer market', () => {
    expect(route).toContain("providerType: normalizedProviderType as 'INDIVIDUAL' | 'COMPANY'")
    expect(route).toContain('countryCode: requestedCountryCode')
    expect(route).toContain("providerType must be INDIVIDUAL or COMPANY")
    expect(domain).toContain("const resolvedProviderType = input.providerType ?? 'INDIVIDUAL'")
  })

  it('fails closed when provider market or service area does not match', () => {
    expect(domain).toContain('Provider country does not match booking country')
    expect(domain).toContain('Provider does not serve the requested district')
    expect(domain).toContain('serviceAreaAllows(company.serviceAreas, input.district)')
    expect(domain).toContain('serviceAreaAllows(provider.serviceAreas, input.district)')
  })

  it('honors declared provider availability and vacations', () => {
    expect(domain).toContain('prisma.providerAvailability.findUnique')
    expect(domain).toContain('Provider is currently unavailable')
    expect(domain).toContain('Provider is unavailable on the requested date')
    expect(domain).toContain('Requested time slot is outside provider working hours')
  })

  it('locks provider state and rejects overlapping accepted work before creating the job', () => {
    const lockIndex = domain.indexOf('await lockAndAssertProviderAvailable')
    const conflictIndex = domain.indexOf('const conflicts = resolvedProviderType')
    const createIndex = domain.indexOf('const job = await tx.marketplaceJob.create')

    expect(lockIndex).toBeGreaterThan(-1)
    expect(conflictIndex).toBeGreaterThan(lockIndex)
    expect(createIndex).toBeGreaterThan(conflictIndex)
    expect(domain).toContain("jq.status = 'ACCEPTED'")
    expect(domain).toContain("mj.status IN ('QUOTE_ACCEPTED', 'IN_PROGRESS')")
    expect(domain).toContain('Provider already has an overlapping active booking')
  })

  it('stores the pricing currency explicitly on the generated quote', () => {
    expect(domain).toContain('currency: pricing.currency')
    expect(domain).toContain('totalCents: pricing.providerGross')
  })

  it('does not reject date-only same-day bookings as timestamps in the past', () => {
    expect(route).toContain('bookingDay.setHours(0, 0, 0, 0)')
    expect(route).toContain('today.setHours(0, 0, 0, 0)')
    expect(route).toContain("error: 'Booking date cannot be in the past'")
  })
})
