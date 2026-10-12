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
      ] },
      taskerSkill: { count: async () => 12 },
    }
    const result = await collectCatalogInventory(db as any)
    expect(result).toMatchObject({
      categories: 2, jobs: 3, serviceTemplates: 2, taskerSkillLinks: 12,
      orphanedCategoryReferences: 1, orphanedServiceJobReferences: 1,
    })
    expect(result.markets).toEqual([
      { countryCode: 'LK', activeCategories: 1, activeJobs: 1, activeServiceTemplates: 0 },
      { countryCode: 'CA', activeCategories: 1, activeJobs: 1, activeServiceTemplates: 1 },
    ])
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
