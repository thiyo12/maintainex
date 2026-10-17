import { describe, expect, it } from 'vitest'
import { collectCatalogInventory } from '@/lib/domain/catalog-inventory'

describe('Phase 00 read-only catalogue inventory', () => {
  it('counts only eligible active country records and identifies broken references', async () => {
    const db = {
      jobCategory: { findMany: async () => [
        { id: 'category-lk', isActive: true, countries: '["LK"]' },
        { id: 'category-ca', isActive: true, countries: '["CA"]' },
      ] },
      templateJob: { findMany: async () => [
        { id: 'job-lk', categoryId: 'category-lk', isActive: true, countries: '["LK"]', currency: 'LKR' },
        { id: 'job-ca', categoryId: 'category-ca', isActive: true, countries: '["CA"]', currency: 'CAD' },
        { id: 'job-orphan', categoryId: 'missing', isActive: true, countries: '["LK"]', currency: 'LKR' },
      ] },
      serviceTemplate: { findMany: async () => [
        { jobCategoryId: 'category-ca', templateJobId: 'job-ca', countryCode: 'CA', currency: 'CAD', isActive: true },
        { jobCategoryId: 'category-ca', templateJobId: 'missing', countryCode: 'CA', currency: 'CAD', isActive: true },
        { jobCategoryId: 'category-lk', templateJobId: 'job-lk', countryCode: 'CA', currency: 'CAD', isActive: true },
        { jobCategoryId: 'category-lk', templateJobId: 'job-ca', countryCode: 'LK', currency: 'CAD', isActive: true },
      ] },
      taskerSkill: { count: async () => 12 },
    }
    const result = await collectCatalogInventory(db as any)
    expect(result).toMatchObject({
      categories: 2, jobs: 3, serviceTemplates: 4, taskerSkillLinks: 12,
      orphanedCategoryReferences: 1, orphanedServiceJobReferences: 1,
      mismatchedServiceCategoryLinks: 1, wrongMarketTemplateCurrencies: 1, wrongMarketJobCurrencies: 0,
    })
    expect(result.markets).toEqual([
      { countryCode: 'LK', activeCategories: 1, activeJobs: 1, activeServiceTemplates: 0 },
      { countryCode: 'CA', activeCategories: 1, activeJobs: 1, activeServiceTemplates: 1 },
    ])
  })
  it('flags a single-currency job offered in two different markets', async () => {
    const db = {
      jobCategory: { findMany: async () => [
        { id: 'shared', isActive: true, countries: '["LK","CA"]' },
      ] },
      templateJob: { findMany: async () => [
        { id: 'shared-job', categoryId: 'shared', isActive: true, countries: '["LK","CA"]', currency: 'LKR' },
      ] },
      serviceTemplate: { findMany: async () => [] },
      taskerSkill: { count: async () => 0 },
    }
    const result = await collectCatalogInventory(db as any)
    expect(result.wrongMarketJobCurrencies).toBe(1)
  })

  it('never counts the wrong-market currency as a bookable catalogue job', async () => {
    const db = {
      jobCategory: { findMany: async () => [
        { id: 'both', isActive: true, countries: '["LK","CA"]' },
      ] },
      templateJob: { findMany: async () => [
        { id: 'wrong-cad', categoryId: 'both', isActive: true, countries: '["CA"]', currency: 'LKR' },
        { id: 'lk-correct', categoryId: 'both', isActive: true, countries: '["LK"]', currency: 'LKR' },
      ] },
      serviceTemplate: { findMany: async () => [] },
      taskerSkill: { count: async () => 0 },
    }
    const result = await collectCatalogInventory(db as any)
    expect(result.markets[0].activeJobs).toBe(1)
    expect(result.markets[1].activeJobs).toBe(0)
    expect(result.wrongMarketJobCurrencies).toBe(1)
  })

  it('cannot count a dual-market single-currency service as bookable', async () => {
    const db = {
      jobCategory: { findMany: async () => [
        { id: 'both', isActive: true, countries: '["LK","CA"]' },
      ] },
      templateJob: { findMany: async () => [
        { id: 'dual', categoryId: 'both', isActive: true, countries: '["LK","CA"]', currency: 'LKR' },
      ] },
      serviceTemplate: { findMany: async () => [] },
      taskerSkill: { count: async () => 0 },
    }
    const result = await collectCatalogInventory(db as any)
    expect(result.markets.map(m => m.activeJobs)).toEqual([0, 0])
    expect(result.wrongMarketJobCurrencies).toBe(1)
  })

  it('does not count an otherwise valid template linked to an unbookable job', async () => {
    const db = {
      jobCategory: { findMany: async () => [
        { id: 'ca', isActive: true, countries: '["CA"]' },
      ] },
      templateJob: { findMany: async () => [
        { id: 'wrong', categoryId: 'ca', isActive: true, countries: '["CA"]', currency: 'LKR' },
      ] },
      serviceTemplate: { findMany: async () => [
        { jobCategoryId: 'ca', templateJobId: 'wrong', countryCode: 'CA', currency: 'CAD', isActive: true },
        { jobCategoryId: 'ca', templateJobId: null, countryCode: 'CA', currency: 'CAD', isActive: true },
      ] },
      taskerSkill: { count: async () => 0 },
    }
    const result = await collectCatalogInventory(db as any)
    expect(result.markets[1]).toEqual({
      countryCode: 'CA', activeCategories: 1, activeJobs: 0, activeServiceTemplates: 1,
    })
  })

  it('does not perform any database mutation', async () => {
    const mutations: string[] = []
    const db = {
      jobCategory: { findMany: async () => [] },
      templateJob: { findMany: async () => [] },
      serviceTemplate: { findMany: async () => [] },
      taskerSkill: { count: async () => 0 },
      update: () => mutations.push('updated'),
    }
    await collectCatalogInventory(db as any)
    expect(mutations).toEqual([])
  })
})
