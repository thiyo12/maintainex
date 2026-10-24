import { describe, expect, it } from 'vitest'

import {
  CATALOGUE_TARGETS,
  parseCountryList,
  summariseCatalogueCoverage,
  validateCatalogueIntegrity,
  type CatalogueCategory,
  type CatalogueJob,
} from '@/lib/catalog/catalog-integrity'

function category(overrides: Partial<CatalogueCategory> = {}): CatalogueCategory {
  return { id: 'cat-1', name: 'Cleaning', slug: 'cleaning', countries: 'LK', isActive: true, ...overrides }
}

function job(overrides: Partial<CatalogueJob> = {}): CatalogueJob {
  return {
    id: 'job-1',
    categoryId: 'cat-1',
    name: 'Deep House Cleaning',
    description: 'Full interior clean',
    whatIsIncluded: 'Kitchen, bathroom, floors',
    typicalDurationMinutes: 180,
    priceMin: 5000,
    priceMax: 15000,
    currency: 'LKR',
    countries: 'LK',
    isActive: true,
    isCompanyOnly: false,
    ...overrides,
  }
}

describe('parseCountryList', () => {
  it('parses JSON-encoded market arrays as stored by the seeds', () => {
    expect(parseCountryList('["LK"]')).toEqual(['LK'])
    expect(parseCountryList('["LK","CA"]')).toEqual(['LK', 'CA'])
    expect(parseCountryList('["lk"," ca "]')).toEqual(['LK', 'CA'])
  })

  it('parses plain comma lists', () => {
    expect(parseCountryList('LK,CA')).toEqual(['LK', 'CA'])
    expect(parseCountryList('lk')).toEqual(['LK'])
  })

  it('handles empty and malformed values safely', () => {
    expect(parseCountryList('')).toEqual([])
    expect(parseCountryList(null)).toEqual([])
    expect(parseCountryList(undefined)).toEqual([])
    expect(parseCountryList('["LK"')).toEqual(['["LK"'])
  })
})

describe('catalogue integrity validators', () => {
  it('accepts a well-formed catalogue', () => {
    expect(validateCatalogueIntegrity([category()], [job()])).toEqual([])
  })

  it('detects duplicate department names case-insensitively', () => {
    const violations = validateCatalogueIntegrity(
      [category(), category({ id: 'cat-2', slug: 'cleaning-2', name: '  cleaning ' })],
      [],
    )
    expect(violations.map(v => v.code)).toContain('DUPLICATE_CATEGORY_NAME')
  })

  it('detects duplicate department slugs', () => {
    const violations = validateCatalogueIntegrity(
      [category(), category({ id: 'cat-2', name: 'Gardening', slug: 'CLEANING' })],
      [],
    )
    expect(violations.map(v => v.code)).toContain('DUPLICATE_CATEGORY_SLUG')
  })

  it('detects services pointing at a missing department', () => {
    const violations = validateCatalogueIntegrity([category()], [job({ categoryId: 'ghost' })])
    expect(violations.map(v => v.code)).toContain('ORPHAN_JOB_CATEGORY')
  })

  it('detects duplicate services inside one department', () => {
    const violations = validateCatalogueIntegrity(
      [category()],
      [job(), job({ id: 'job-2', name: 'deep house CLEANING' })],
    )
    expect(violations.map(v => v.code)).toContain('DUPLICATE_JOB_IN_CATEGORY')
  })

  it('allows the same service name in different departments', () => {
    expect(
      validateCatalogueIntegrity(
        [category(), category({ id: 'cat-2', name: 'Gardening', slug: 'gardening' })],
        [job(), job({ id: 'job-2', categoryId: 'cat-2' })],
      ),
    ).toEqual([])
  })

  it('flags incomplete service content', () => {
    const violations = validateCatalogueIntegrity(
      [category()],
      [job({ description: '', whatIsIncluded: null })],
    )
    const codes = violations.map(v => v.code)
    expect(codes).toContain('JOB_MISSING_DESCRIPTION')
    expect(codes).toContain('JOB_MISSING_INCLUDED')
  })

  it('flags invalid duration and inverted price ranges', () => {
    const violations = validateCatalogueIntegrity(
      [category()],
      [job({ typicalDurationMinutes: 0, priceMin: 9000, priceMax: 1000 })],
    )
    const codes = violations.map(v => v.code)
    expect(codes).toContain('JOB_INVALID_DURATION')
    expect(codes).toContain('JOB_INVALID_PRICE_RANGE')
  })

  it('rejects currencies outside the launch markets', () => {
    const violations = validateCatalogueIntegrity([category()], [job({ currency: 'USD' })])
    expect(violations.map(v => v.code)).toContain('JOB_UNSUPPORTED_CURRENCY')
  })

  it('rejects markets outside the launch scope', () => {
    const violations = validateCatalogueIntegrity([category()], [job({ countries: 'LK,AU' })])
    expect(violations.map(v => v.code)).toContain('JOB_UNSUPPORTED_COUNTRY')
  })

  it('rejects a service whose currency contradicts its advertised market', () => {
    const violations = validateCatalogueIntegrity(
      [category()],
      [job({ countries: 'CA', currency: 'LKR' })],
    )
    expect(violations.map(v => v.code)).toContain('JOB_CURRENCY_MARKET_MISMATCH')
  })

  it('allows pending inactive proposed services in a live department without activating them', () => {
    expect(validateCatalogueIntegrity([category()], [job({ isActive: false })])).toEqual([])
    expect(summariseCatalogueCoverage([category()], [job({ isActive: false })]).serviceJobs).toBe(0)
  })

  it('accepts JSON-encoded market assignments as seeded', () => {
    expect(
      validateCatalogueIntegrity(
        [category({ countries: '["LK","CA"]' })],
        [job({ countries: '["LK"]' }), job({ id: 'job-ca', name: 'Vancouver Clean', categoryId: 'cat-1', countries: '["CA"]', currency: 'CAD' })],
      ),
    ).toEqual([])
  })

  it('rejects a service offered in a market missing from its parent category', () => {
    const issues = validateCatalogueIntegrity([category({ countries: '["LK"]' })], [
      job({ countries: '["CA"]', currency: 'CAD' }),
    ])
    expect(issues.map(issue => issue.code)).toContain('JOB_COUNTRY_OUTSIDE_CATEGORY')
  })

  it('does not count orphan jobs or services in inactive departments as active coverage', () => {
    const coverage = summariseCatalogueCoverage([
      category(), category({ id: 'inactive', name: 'Draft', slug: 'draft', isActive: false }),
    ], [
      job(), job({ id: 'orphan', categoryId: 'missing' }),
      job({ id: 'draft', categoryId: 'inactive' }),
    ])
    expect(coverage.serviceJobs).toBe(1)
    expect(coverage.byMarket.LK.serviceJobs).toBe(1)
  })

  it('does not count cross-market or wrong-currency services in per-market coverage', () => {
    const coverage = summariseCatalogueCoverage([category()], [
      job(),
      job({ id: 'wrong-market', countries: 'CA', currency: 'CAD' }),
      job({ id: 'wrong-currency', countries: 'LK', currency: 'CAD' }),
    ])
    expect(coverage.byMarket.LK.serviceJobs).toBe(1)
    expect(coverage.byMarket.CA?.serviceJobs ?? 0).toBe(0)
  })

  it('rejects a service with no market assignment', () => {
    const violations = validateCatalogueIntegrity([category()], [job({ countries: '' })])
    const codes = violations.map(v => v.code)
    expect(codes).toContain('JOB_UNSUPPORTED_COUNTRY')
    expect(codes).not.toContain('JOB_CURRENCY_MARKET_MISMATCH')
  })
})

describe('catalogue coverage reporting', () => {
  it('targets the approved 27 departments and 548 service jobs', () => {
    expect(CATALOGUE_TARGETS.departments).toBe(27)
    expect(CATALOGUE_TARGETS.serviceJobs).toBe(548)
  })

  it('counts active coverage per market and reports the shortfall', () => {
    const categories = [
      category(),
      category({ id: 'cat-2', name: 'Gardening', slug: 'gardening', countries: 'CA' }),
    ]
    const jobs = [
      job(),
      job({ id: 'job-2', categoryId: 'cat-2', currency: 'CAD', countries: 'CA' }),
      job({ id: 'job-3', isActive: false }),
    ]

    const coverage = summariseCatalogueCoverage(categories, jobs)
    expect(coverage.departments).toBe(2)
    expect(coverage.serviceJobs).toBe(2)
    expect(coverage.byMarket.LK).toEqual({ departments: 1, serviceJobs: 1 })
    expect(coverage.byMarket.CA).toEqual({ departments: 1, serviceJobs: 1 })
    expect(coverage.departmentsGap).toBe(25)
    expect(coverage.serviceJobsGap).toBe(546)
    expect(coverage.complete).toBe(false)
  })

  it('reports completeness once the approved targets are met', () => {
    const categories = Array.from({ length: CATALOGUE_TARGETS.departments }, (_, i) =>
      category({ id: `cat-${i}`, name: `Dept ${i}`, slug: `dept-${i}` }),
    )
    const jobs = Array.from({ length: CATALOGUE_TARGETS.serviceJobs }, (_, i) =>
      job({ id: `job-${i}`, name: `Service ${i}` }),
    )
    const coverage = summariseCatalogueCoverage(categories, jobs)
    expect(coverage.complete).toBe(true)
    expect(coverage.departmentsGap).toBe(0)
    expect(coverage.serviceJobsGap).toBe(0)
  })
})