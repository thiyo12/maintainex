/**
 * Service catalogue integrity rules (Phase 01).
 *
 * The catalogue is discovered by customers, selected by providers and managed by
 * CRM staff, so a broken category relationship or a duplicated service is a
 * production-visible defect. These validators are deliberately pure so they can
 * be unit tested without a database, and reused by the DB-backed integrity test.
 */

export interface CatalogueCategory {
  id: string
  name: string
  slug?: string | null
  countries?: string | null
  isActive?: boolean
}

export interface CatalogueJob {
  id: string
  categoryId: string
  name: string
  description?: string | null
  whatIsIncluded?: string | null
  typicalDurationMinutes?: number | null
  priceMin?: number | null
  priceMax?: number | null
  currency?: string | null
  countries?: string | null
  isActive?: boolean
  isCompanyOnly?: boolean
}

/** Approved launch catalogue targets. */
export const CATALOGUE_TARGETS = {
  departments: 27,
  serviceJobs: 548,
} as const

export const SUPPORTED_CURRENCIES = ['LKR', 'CAD'] as const

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

/**
 * Catalogue market assignments are persisted as a String column in two shapes
 * depending on the seed: a JSON array (`["LK","CA"]`, used by
 * prisma/seed-job-section.ts and seed-new-menu-categories.ts) or a plain comma
 * list (`LK,CA`). Both must parse identically or seeded rows read as invalid.
 */
export function parseCountryList(value: string | null | undefined): string[] {
  const raw = (value || '').trim()
  if (!raw) return []

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .map(entry => String(entry).trim().toUpperCase())
          .filter(Boolean)
      }
    } catch {
      // Fall through to comma splitting for malformed values.
    }
  }

  return raw
    .split(',')
    .map(part => part.trim().toUpperCase())
    .filter(Boolean)
}

export type IntegrityViolation = {
  code:
    | 'DUPLICATE_CATEGORY_NAME'
    | 'DUPLICATE_CATEGORY_SLUG'
    | 'ORPHAN_JOB_CATEGORY'
    | 'DUPLICATE_JOB_IN_CATEGORY'
    | 'JOB_MISSING_DESCRIPTION'
    | 'JOB_MISSING_INCLUDED'
    | 'JOB_INVALID_DURATION'
    | 'JOB_INVALID_PRICE_RANGE'
    | 'JOB_UNSUPPORTED_CURRENCY'
    | 'JOB_CURRENCY_MARKET_MISMATCH'
    | 'JOB_UNSUPPORTED_COUNTRY'
    | 'INACTIVE_JOB_IN_ACTIVE_CATEGORY'
  entity: string
  detail: string
}

/**
 * Validates catalogue structure. Pure: pass the rows, get every violation.
 */
export function validateCatalogueIntegrity(
  categories: CatalogueCategory[],
  jobs: CatalogueJob[],
): IntegrityViolation[] {
  const violations: IntegrityViolation[] = []

  // --- departments ---
  const byName = new Map<string, CatalogueCategory>()
  const bySlug = new Map<string, CatalogueCategory>()
  for (const category of categories) {
    const nameKey = normalize(category.name)
    if (!nameKey) {
      violations.push({
        code: 'DUPLICATE_CATEGORY_NAME',
        entity: category.id,
        detail: 'Department has an empty name',
      })
      continue
    }
    if (byName.has(nameKey)) {
      violations.push({
        code: 'DUPLICATE_CATEGORY_NAME',
        entity: category.id,
        detail: `Duplicate department name "${category.name}"`,
      })
    } else {
      byName.set(nameKey, category)
    }

    const slugKey = normalize(category.slug)
    if (slugKey) {
      if (bySlug.has(slugKey)) {
        violations.push({
          code: 'DUPLICATE_CATEGORY_SLUG',
          entity: category.id,
          detail: `Duplicate department slug "${category.slug}"`,
        })
      } else {
        bySlug.set(slugKey, category)
      }
    }
  }

  const categoryById = new Map(categories.map(category => [category.id, category]))
  const jobKeys = new Set<string>()

  // --- service jobs ---
  for (const job of jobs) {
    const category = categoryById.get(job.categoryId)
    if (!category) {
      violations.push({
        code: 'ORPHAN_JOB_CATEGORY',
        entity: job.id,
        detail: `Service "${job.name}" references a missing department`,
      })
      continue
    }

    const jobKey = `${job.categoryId}::${normalize(job.name)}`
    if (jobKeys.has(jobKey)) {
      violations.push({
        code: 'DUPLICATE_JOB_IN_CATEGORY',
        entity: job.id,
        detail: `Duplicate service "${job.name}" within department "${category.name}"`,
      })
    }
    jobKeys.add(jobKey)

    if (!normalize(job.description)) {
      violations.push({
        code: 'JOB_MISSING_DESCRIPTION',
        entity: job.id,
        detail: `Service "${job.name}" has no description`,
      })
    }
    if (!normalize(job.whatIsIncluded)) {
      violations.push({
        code: 'JOB_MISSING_INCLUDED',
        entity: job.id,
        detail: `Service "${job.name}" has no "what is included" content`,
      })
    }
    if (
      typeof job.typicalDurationMinutes !== 'number' ||
      !Number.isFinite(job.typicalDurationMinutes) ||
      job.typicalDurationMinutes <= 0
    ) {
      violations.push({
        code: 'JOB_INVALID_DURATION',
        entity: job.id,
        detail: `Service "${job.name}" has an invalid duration`,
      })
    }

    const hasMin = typeof job.priceMin === 'number' && Number.isFinite(job.priceMin)
    const hasMax = typeof job.priceMax === 'number' && Number.isFinite(job.priceMax)
    if (!hasMin || !hasMax || (job.priceMin as number) < 0 || (job.priceMax as number) < 0) {
      violations.push({
        code: 'JOB_INVALID_PRICE_RANGE',
        entity: job.id,
        detail: `Service "${job.name}" has an invalid price range`,
      })
    } else if ((job.priceMax as number) < (job.priceMin as number)) {
      violations.push({
        code: 'JOB_INVALID_PRICE_RANGE',
        entity: job.id,
        detail: `Service "${job.name}" has priceMax below priceMin`,
      })
    }

    const currency = (job.currency || '').trim().toUpperCase()
    if (!SUPPORTED_CURRENCIES.includes(currency as (typeof SUPPORTED_CURRENCIES)[number])) {
      violations.push({
        code: 'JOB_UNSUPPORTED_CURRENCY',
        entity: job.id,
        detail: `Service "${job.name}" has unsupported currency "${job.currency}"`,
      })
    }

    const jobCountries = parseCountryList(job.countries)
    if (jobCountries.length === 0) {
      violations.push({
        code: 'JOB_UNSUPPORTED_COUNTRY',
        entity: job.id,
        detail: `Service "${job.name}" is not assigned to any market`,
      })
    } else {
      for (const country of jobCountries) {
        if (country !== 'LK' && country !== 'CA') {
          violations.push({
            code: 'JOB_UNSUPPORTED_COUNTRY',
            entity: job.id,
            detail: `Service "${job.name}" references unsupported market "${country}"`,
          })
        }
      }
      // A service must not advertise a market whose currency it does not price in.
      if (
        (jobCountries.includes('LK') && currency !== 'LKR') ||
        (jobCountries.includes('CA') && currency !== 'CAD')
      ) {
        violations.push({
          code: 'JOB_CURRENCY_MARKET_MISMATCH',
          entity: job.id,
          detail: `Service "${job.name}" prices in ${currency} but claims markets ${jobCountries.join(',')}`,
        })
      }
    }

    if (
      job.isActive === false &&
      category.isActive !== false &&
      jobCountries.length > 0
    ) {
      violations.push({
        code: 'INACTIVE_JOB_IN_ACTIVE_CATEGORY',
        entity: job.id,
        detail: `Service "${job.name}" is inactive inside an active department`,
      })
    }
  }

  return violations
}

export interface CatalogueCoverage {
  departments: number
  serviceJobs: number
  byMarket: Record<string, { departments: number; serviceJobs: number }>
  targetDepartments: number
  targetServiceJobs: number
  departmentsGap: number
  serviceJobsGap: number
  complete: boolean
}

/**
 * Reports actual catalogue coverage against the approved launch targets so the
 * shortfall is measurable rather than assumed.
 */
export function summariseCatalogueCoverage(
  categories: CatalogueCategory[],
  jobs: CatalogueJob[],
): CatalogueCoverage {
  const activeCategories = categories.filter(category => category.isActive !== false)
  const byMarket: CatalogueCoverage['byMarket'] = {}

  for (const category of categories) {
    for (const country of parseCountryList(category.countries)) {
      byMarket[country] = byMarket[country] || { departments: 0, serviceJobs: 0 }
      if (category.isActive !== false) byMarket[country].departments += 1
    }
  }
  for (const job of jobs) {
    if (job.isActive === false) continue
    for (const country of parseCountryList(job.countries)) {
      byMarket[country] = byMarket[country] || { departments: 0, serviceJobs: 0 }
      byMarket[country].serviceJobs += 1
    }
  }

  const serviceJobs = jobs.filter(job => job.isActive !== false).length
  const departments = activeCategories.length

  return {
    departments,
    serviceJobs,
    byMarket,
    targetDepartments: CATALOGUE_TARGETS.departments,
    targetServiceJobs: CATALOGUE_TARGETS.serviceJobs,
    departmentsGap: Math.max(0, CATALOGUE_TARGETS.departments - departments),
    serviceJobsGap: Math.max(0, CATALOGUE_TARGETS.serviceJobs - serviceJobs),
    complete:
      departments >= CATALOGUE_TARGETS.departments &&
      serviceJobs >= CATALOGUE_TARGETS.serviceJobs,
  }
}