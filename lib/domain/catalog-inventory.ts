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
    mismatchedServiceCategoryLinks: templates.filter(t => t.templateJobId &&
      jobs.some(j => j.id === t.templateJobId && j.categoryId !== t.jobCategoryId)).length,
    wrongMarketJobCurrencies: jobs.filter(j => {
      const hasLK = isCatalogAvailableInMarket(j.countries, 'LK')
      const hasCA = isCatalogAvailableInMarket(j.countries, 'CA')
      // Cross-market templates require independently priced market-specific variants.
      // One shared currency field cannot safely price a job in both currencies.
      return (hasLK && hasCA) ||
        (hasLK && j.currency !== 'LKR') ||
        (hasCA && j.currency !== 'CAD')
    }).length,
    wrongMarketTemplateCurrencies: templates.filter(t =>
      (t.countryCode === 'LK' && t.currency !== 'LKR') ||
      (t.countryCode === 'CA' && t.currency !== 'CAD')
    ).length,
    markets,
  }
}

/**
 * Read-only provider association inventory (Phase 01 exit gate).
 *
 * The catalogue is only useful if providers stay linked to the services they
 * can actually deliver. These aggregate checks prove that catalogue work never
 * silently strands a provider, without exposing any personal information.
 */
export async function collectProviderAssociations(
  db: Pick<PrismaClient, 'templateJob' | 'jobCategory' | 'taskerSkill' | 'taskerProfile'>,
) {
  const [jobs, categories, skills, taskerCount] = await Promise.all([
    db.templateJob.findMany({
      select: {
        id: true,
        categoryId: true,
        isActive: true,
        countries: true,
        _count: { select: { taskerSkills: true } },
      },
    }),
    db.jobCategory.findMany({ select: { id: true, isActive: true } }),
    db.taskerSkill.findMany({ select: { id: true, jobId: true, taskerId: true, currency: true } }),
    db.taskerProfile.count(),
  ])

  const jobIds = new Set(jobs.map(j => j.id))
  const categoryById = new Map(categories.map(c => [c.id, c]))
  const linkedTaskers = new Set(skills.map(s => s.taskerId))

  const providerLinksPerJob = new Map<string, number>()
  for (const skill of skills) {
    providerLinksPerJob.set(skill.jobId, (providerLinksPerJob.get(skill.jobId) ?? 0) + 1)
  }

  const jobsWithNoProviders = jobs.filter(j => (providerLinksPerJob.get(j.id) ?? 0) === 0)

  return {
    taskers: taskerCount,
    taskersWithCatalogueSkills: linkedTaskers.size,
    taskersWithoutCatalogueSkills: Math.max(0, taskerCount - linkedTaskers.size),
    providerSkillLinks: skills.length,
    jobsWithProviders: jobs.length - jobsWithNoProviders.length,
    jobsWithNoProviders: jobsWithNoProviders.length,
    /** Provider links that point at a template job that no longer exists. */
    orphanedProviderLinks: skills.filter(s => !jobIds.has(s.jobId)).length,
    /** Provider links whose job belongs to a now inactive department. */
    providerLinksInInactiveDepartments: skills.filter(s => {
      const job = jobs.find(j => j.id === s.jobId)
      return !!job && categoryById.get(job.categoryId)?.isActive === false
    }).length,
    /** Provider links whose job is inactive, so they cannot be discovered. */
    providerLinksOnInactiveJobs: skills.filter(s => {
      const job = jobs.find(j => j.id === s.jobId)
      return !!job && job.isActive === false
    }).length,
    /** Provider rate currencies that contradict the job's market. */
    providerLinksWithWrongCurrency: skills.filter(s => {
      const job = jobs.find(j => j.id === s.jobId)
      if (!job) return false
      const hasLK = isCatalogAvailableInMarket(job.countries, 'LK')
      const hasCA = isCatalogAvailableInMarket(job.countries, 'CA')
      return (hasLK && s.currency !== 'LKR') || (hasCA && s.currency !== 'CAD')
    }).length,
    topUnstaffedJobs: jobsWithNoProviders.slice(0, 25).map(j => ({
      id: j.id,
      providerLinks: 0,
    })),
  }
}
