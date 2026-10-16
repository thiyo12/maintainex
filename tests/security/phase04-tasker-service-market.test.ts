import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isTaskerServiceAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'

const categoryLK = { isActive: true, countries: '["LK"]' }
const categoryCA = { isActive: true, countries: '["CA"]' }
const categoryBoth = { isActive: true, countries: '["LK","CA"]' }
const jobLK = { isActive: true, isCompanyOnly: false, countries: '["LK"]', currency: 'LKR' }
const jobCA = { isActive: true, isCompanyOnly: false, countries: '["CA"]', currency: 'CAD' }

describe('Phase 04 — individual provider service selection by verified market', () => {
  it('allows an active LK/LKR job in an active LK category', () => {
    expect(isTaskerServiceAvailableInMarket(jobLK, categoryLK, 'LK')).toBe(true)
  })

  it('allows an active CA/CAD job in an active Canadian category', () => {
    expect(isTaskerServiceAvailableInMarket(jobCA, categoryCA, 'CA')).toBe(true)
  })

  it('refuses Canadian jobs for Sri Lankan providers and the inverse', () => {
    expect(isTaskerServiceAvailableInMarket(jobCA, categoryBoth, 'LK')).toBe(false)
    expect(isTaskerServiceAvailableInMarket(jobLK, categoryBoth, 'CA')).toBe(false)
  })

  it('refuses mismatched local currency even if metadata includes the market', () => {
    expect(isTaskerServiceAvailableInMarket({ ...jobCA, currency: 'LKR' }, categoryCA, 'CA')).toBe(false)
    expect(isTaskerServiceAvailableInMarket({ ...jobLK, currency: 'CAD' }, categoryLK, 'LK')).toBe(false)
  })

  it('refuses company-only and inactive services', () => {
    expect(isTaskerServiceAvailableInMarket({ ...jobCA, isCompanyOnly: true }, categoryCA, 'CA')).toBe(false)
    expect(isTaskerServiceAvailableInMarket({ ...jobCA, isActive: false }, categoryCA, 'CA')).toBe(false)
  })

  it('refuses inactive, wrong-market and malformed parent categories', () => {
    expect(isTaskerServiceAvailableInMarket(jobCA, { ...categoryCA, isActive: false }, 'CA')).toBe(false)
    expect(isTaskerServiceAvailableInMarket(jobCA, categoryLK, 'CA')).toBe(false)
    expect(isTaskerServiceAvailableInMarket(jobCA, { isActive: true, countries: 'not json' }, 'CA')).toBe(false)
  })

  it('refuses malformed job market metadata', () => {
    expect(isTaskerServiceAvailableInMarket({ ...jobCA, countries: 'CA' }, categoryCA, 'CA')).toBe(false)
  })
})

describe('Phase 04 — service selection route boundary', () => {
  const route = readFileSync(resolve(process.cwd(), 'app/api/mobile/taskers/skills/route.ts'), 'utf8')

  it('uses one market-eligibility helper in both list and save paths', () => {
    expect((route.match(/isTaskerServiceAvailableInMarket\(/g) || []).length).toBeGreaterThanOrEqual(3)
    expect(route).toContain('isCatalogAvailableInMarket(cat.countries, market)')
  })

  it('rejects wrong-market selections before modifying persisted skills', () => {
    const rejected = route.indexOf('if (allowedIds.size !== jobIds.length)')
    const deleted = route.indexOf('await prisma.taskerSkill.deleteMany')
    expect(rejected).toBeGreaterThan(-1)
    expect(deleted).toBeGreaterThan(rejected)
    expect(route).toContain('unavailable in your market')
  })

  it('never uses an unrestricted delete to replace market-scoped selections', () => {
    expect(route).not.toContain('where: { taskerId: tasker.id, jobId: { notIn: saveIds } }')
    expect(route).not.toContain('await prisma.taskerSkill.deleteMany({ where: { taskerId: tasker.id } })')
    expect(route).toContain('jobId: { in: toRemove }')
    expect(route).toContain('preservedSelections')
  })

  it('persists the authenticated market and matching currency on skill rows', () => {
    expect((route.match(/countryCode: market/g) || []).length).toBeGreaterThanOrEqual(2)
    expect((route.match(/getCurrencyForCountry\(market\)/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})
