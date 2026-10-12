import type { PrismaClient } from '@prisma/client'
import { isCatalogAvailableInMarket } from './catalog-market-eligibility'

/**
 * Read-only baseline inventory for release auditing. Returns aggregate counts,
 * not personal information or user identifiers; never seeds or mutates data.
 */
export async function collectCatalogInventory(db: Pick<PrismaClient, 'jobCategory' | 'templateJob' | 'serviceTemplate' | 'taskerSkill'>) {
  const [categories, jobs, templates, skillCount] = await Promise.all([
    db.jobCategory.findMany({ select: { id: true, isActive: true, countries: true } }),
    db.templateJob.findMany({ select: { id: true, categoryId: true, isActive: true, countries: true, currency: true } }),
    db.serviceTemplate.findMany({ select: { jobCategoryId: true, templateJobId: true, countryCode: true, currency: true, isActive: true } }),
    db.taskerSkill.count(),
  ])
  const categoryIds = new Set(categories.map(c => c.id))
  const jobIds = new Set(jobs.map(j => j.id))
  const categoryById = new Map(categories.map(c => [c.id, c]))
  const markets = (['LK', 'CA'] as const).map(countryCode => ({
    countryCode,
    activeCategories: categories.filter(c => c.isActive && isCatalogAvailableInMarket(c.countries, countryCode)).length,
    activeJobs: jobs.filter(j => j.isActive && isCatalogAvailableInMarket(j.countries, countryCode) &&
      !!categoryById.get(j.categoryId)?.isActive &&
      isCatalogAvailableInMarket(categoryById.get(j.categoryId)!.countries, countryCode)).length,
    activeServiceTemplates: templates.filter(t => t.isActive && t.countryCode === countryCode &&
      t.currency === (countryCode === 'LK' ? 'LKR' : 'CAD') &&
      !!categoryById.get(t.jobCategoryId)?.isActive &&
      isCatalogAvailableInMarket(categoryById.get(t.jobCategoryId)!.countries, countryCode) &&
      (!t.templateJobId || jobs.some(j => j.id === t.templateJobId && j.categoryId === t.jobCategoryId &&
        j.isActive && isCatalogAvailableInMarket(j.countries, countryCode)))).length,
  }))
  return {
    categories: categories.length,
    jobs: jobs.length,
    serviceTemplates: templates.length,
    taskerSkillLinks: skillCount,
    orphanedCategoryReferences: jobs.filter(j => !categoryIds.has(j.categoryId)).length,
    orphanedServiceCategoryReferences: templates.filter(t => !categoryIds.has(t.jobCategoryId)).length,
    orphanedServiceJobReferences: templates.filter(t => t.templateJobId && !jobIds.has(t.templateJobId)).length,
    markets,
  }
}
