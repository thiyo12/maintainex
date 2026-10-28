import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isBookNowCatalogueAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'

const categoryBoth = { isActive: true, countries: '["LK","CA"]' }
const jobLK = { isActive: true, countries: '["LK"]', currency: 'LKR' }
const jobCA = { isActive: true, countries: '["CA"]', currency: 'CAD' }

// Test the real authorization helper and its usage in the direct-booking writer.
const writer = readFileSync(resolve(process.cwd(), 'lib/domain/book-now.ts'), 'utf8')

describe('Phase 01 — BOOK_NOW canonical catalogue market integrity', () => {
  it('accepts only LKR/LK for Sri Lankan direct bookings', () => {
    expect(isBookNowCatalogueAvailableInMarket(jobLK, categoryBoth, 'LK')).toBe(true)
    expect(isBookNowCatalogueAvailableInMarket(jobLK, categoryBoth, 'CA')).toBe(false)
  })
  it('accepts only CAD/CA for Vancouver direct bookings', () => {
    expect(isBookNowCatalogueAvailableInMarket(jobCA, categoryBoth, 'CA')).toBe(true)
    expect(isBookNowCatalogueAvailableInMarket(jobCA, categoryBoth, 'LK')).toBe(false)
  })
  it('rejects foreign-priced jobs despite a valid country grant', () => {
    expect(isBookNowCatalogueAvailableInMarket({ ...jobCA, currency: 'LKR' }, categoryBoth, 'CA')).toBe(false)
    expect(isBookNowCatalogueAvailableInMarket({ ...jobLK, currency: 'CAD' }, categoryBoth, 'LK')).toBe(false)
  })
  it('rejects a dual-market TemplateJob with one single currency', () => {
    const shared = { isActive: true, countries: '["LK","CA"]', currency: 'LKR' }
    expect(isBookNowCatalogueAvailableInMarket(shared, categoryBoth, 'LK')).toBe(false)
    expect(isBookNowCatalogueAvailableInMarket(shared, categoryBoth, 'CA')).toBe(false)
  })
  it('rejects inactive services and inactive or wrong-market parents', () => {
    expect(isBookNowCatalogueAvailableInMarket({ ...jobCA, isActive: false }, categoryBoth, 'CA')).toBe(false)
    expect(isBookNowCatalogueAvailableInMarket(jobCA, { ...categoryBoth, isActive: false }, 'CA')).toBe(false)
    expect(isBookNowCatalogueAvailableInMarket(jobCA, { isActive: true, countries: '["LK"]' }, 'CA')).toBe(false)
  })
  it('fails closed on corrupt or absent market metadata', () => {
    expect(isBookNowCatalogueAvailableInMarket({ ...jobCA, countries: 'CA' }, categoryBoth, 'CA')).toBe(false)
    expect(isBookNowCatalogueAvailableInMarket(jobCA, { isActive: true, countries: '' }, 'CA')).toBe(false)
  })
  it('the direct-booking writer checks its selected job and parent before pricing', () => {
    const gate = writer.indexOf('isBookNowCatalogueAvailableInMarket(templateJob, category, finalCountryCode)')
    const pricing = writer.indexOf('const pricing = await calculatePrice(')
    expect(gate).toBeGreaterThan(0)
    expect(gate).toBeLessThan(pricing)
    expect(writer).toContain('Template job is not available in booking country')
    expect(writer).toContain('countries: true,')
    expect(writer).toContain('currency: true,')
  })
  it('associated pricing templates must match the booking country and currency', () => {
    const linked = writer.slice(writer.indexOf('const linkedServiceTemplate ='), writer.indexOf('const requirements ='))
    expect(linked).toContain('countryCode: finalCountryCode')
    expect(linked).toContain("currency: finalCountryCode === 'LK' ? 'LKR' : 'CAD'")
  })
  it('rejects unsupported market codes before looking for linked templates', () => {
    expect(writer).toContain("if (finalCountryCode !== 'LK' && finalCountryCode !== 'CA')")
  })
})
