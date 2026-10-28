/**
 * Integrity rules for the PROPOSED catalogue expansion (Phase 01, Step 4).
 *
 * The proposal must never weaken the live catalogue, so these validators check
 * it against the real 24 department / 239 service baseline and against the
 * launch-market rules.
 */

import { CATALOGUE_TARGETS } from './catalog-integrity'
import type {
  ProposedDepartment,
  ProposedService,
  ProposedSkill,
} from './proposed-expansion'

export interface ExistingCatalogue {
  departments: Array<{ slug: string; name: string; jobs: string[] }>
}

export type ProposedViolationCode =
  | 'DUPLICATE_PROPOSED_DEPARTMENT'
  | 'DUPLICATE_PROPOSED_SERVICE'
  | 'DUPLICATE_EXISTING_SERVICE'
  | 'DUPLICATE_PROPOSED_SKILL'
  | 'UNKNOWN_SKILL_REFERENCE'
  | 'UNKNOWN_DEPARTMENT'
  | 'MISSING_MARKET'
  | 'CANADIAN_PRICE_INVENTED'
  | 'MISSING_LK_PRICE'
  | 'INVALID_DURATION'
  | 'INVALID_PROVIDER_TYPE'
  | 'EMPTY_INCLUDED_LIST'
  | 'MISSING_DESCRIPTION'

export interface ProposedViolation {
  code: ProposedViolationCode
  entity: string
  detail: string
}

const SUPPORTED_PROVIDER_TYPES = ['INDIVIDUAL', 'COMPANY', 'EITHER']

export function validateProposedExpansion(
  departments: ProposedDepartment[],
  services: ProposedService[],
  skills: ProposedSkill[],
  existing: ExistingCatalogue,
): ProposedViolation[] {
  const violations: ProposedViolation[] = []

  const existingDepartmentSlugs = new Set(existing.departments.map(d => d.slug))
  const proposedDepartmentSlugs = new Set<string>()
  const allDepartmentSlugs = new Set([...existingDepartmentSlugs])

  for (const department of departments) {
    if (proposedDepartmentSlugs.has(department.slug)) {
      violations.push({
        code: 'DUPLICATE_PROPOSED_DEPARTMENT',
        entity: department.slug,
        detail: `Department "${department.slug}" is declared more than once in the proposal`,
      })
    }
    proposedDepartmentSlugs.add(department.slug)
    allDepartmentSlugs.add(department.slug)

    if (existingDepartmentSlugs.has(department.slug)) {
      violations.push({
        code: 'DUPLICATE_PROPOSED_DEPARTMENT',
        entity: department.slug,
        detail: `Department "${department.slug}" already exists in the live catalogue and must not be re-declared`,
      })
    }

    if (!department.markets || department.markets.length === 0) {
      violations.push({
        code: 'MISSING_MARKET',
        entity: department.slug,
        detail: `Proposed department "${department.slug}" has no market eligibility`,
      })
    }
  }

  // Every skill referenced must be declared, so providers can never be asked for
  // a skill that does not exist in the taxonomy.
  const declaredSkillSlugs = new Set(skills.map(skill => skill.slug))

  // Service names must not collide with the live catalogue or with each other.
  const existingNames = new Map<string, string>()
  for (const department of existing.departments) {
    for (const job of department.jobs) {
      existingNames.set(`${department.slug}::${job.trim().toLowerCase()}`, job)
    }
  }
  const proposedNames = new Set<string>()

  for (const service of services) {
    const key = `${service.department}::${service.name.trim().toLowerCase()}`

    if (!service.description || service.description.trim().length < 10) {
      violations.push({
        code: 'MISSING_DESCRIPTION',
        entity: service.name,
        detail: `Proposed service "${service.name}" needs a real customer-facing description`,
      })
    }

    if (!allDepartmentSlugs.has(service.department)) {
      violations.push({
        code: 'UNKNOWN_DEPARTMENT',
        entity: service.name,
        detail: `Proposed service "${service.name}" references unknown department "${service.department}"`,
      })
    }

    if (proposedNames.has(key)) {
      violations.push({
        code: 'DUPLICATE_PROPOSED_SERVICE',
        entity: service.name,
        detail: `Proposed service "${service.name}" is declared more than once in ${service.department}`,
      })
    }
    proposedNames.add(key)

    if (existingNames.has(key)) {
      violations.push({
        code: 'DUPLICATE_EXISTING_SERVICE',
        entity: service.name,
        detail: `Proposed service "${service.name}" already exists in the live catalogue as "${existingNames.get(key)}"`,
      })
    }

    if (!service.whatIsIncluded || service.whatIsIncluded.length === 0) {
      violations.push({
        code: 'EMPTY_INCLUDED_LIST',
        entity: service.name,
        detail: `Proposed service "${service.name}" has no included-scope detail`,
      })
    }

    if (
      typeof service.typicalDurationMinutes !== 'number' ||
      !Number.isFinite(service.typicalDurationMinutes) ||
      service.typicalDurationMinutes <= 0
    ) {
      violations.push({
        code: 'INVALID_DURATION',
        entity: service.name,
        detail: `Proposed service "${service.name}" has an invalid duration`,
      })
    }

    if (!SUPPORTED_PROVIDER_TYPES.includes(service.providerType)) {
      violations.push({
        code: 'INVALID_PROVIDER_TYPE',
        entity: service.name,
        detail: `Proposed service "${service.name}" has invalid provider type "${service.providerType}"`,
      })
    }

    if (!service.markets || service.markets.length === 0) {
      violations.push({
        code: 'MISSING_MARKET',
        entity: service.name,
        detail: `Proposed service "${service.name}" has no market eligibility`,
      })
    }

    // No Canadian price benchmarks may be invented.
    if (service.markets?.includes('CA') && service.priceLKR) {
      // priceLKR is explicitly a Sri Lankan band, so a Canada-only service must
      // not carry one at all.
      if (!service.markets.includes('LK')) {
        violations.push({
          code: 'CANADIAN_PRICE_INVENTED',
          entity: service.name,
          detail: `Proposed service "${service.name}" is Canada-only and must not carry a price benchmark`,
        })
      }
    }

    if (service.markets?.includes('LK') && !service.priceLKR) {
      violations.push({
        code: 'MISSING_LK_PRICE',
        entity: service.name,
        detail: `Proposed service "${service.name}" is offered in Sri Lanka but has no indicative LKR band`,
      })
    }

    if (service.priceLKR && service.priceLKR.max < service.priceLKR.min) {
      violations.push({
        code: 'MISSING_LK_PRICE',
        entity: service.name,
        detail: `Proposed service "${service.name}" has an inverted price band`,
      })
    }

    for (const skill of service.skills) {
      if (!declaredSkillSlugs.has(skill)) {
        violations.push({
          code: 'UNKNOWN_SKILL_REFERENCE',
          entity: service.name,
          detail: `Proposed service "${service.name}" references undeclared skill "${skill}"`,
        })
      }
    }
  }

  const skillSlugs = new Set<string>()
  for (const skill of skills) {
    if (skillSlugs.has(skill.slug)) {
      violations.push({
        code: 'DUPLICATE_PROPOSED_SKILL',
        entity: skill.slug,
        detail: `Proposed skill "${skill.slug}" is declared more than once`,
      })
    }
    skillSlugs.add(skill.slug)
  }

  return violations
}

export interface ProposedCoverage {
  liveDepartments: number
  liveServices: number
  proposedDepartments: number
  proposedServices: number
  resultingDepartments: number
  resultingServices: number
  targetDepartments: number
  targetServices: number
  servicesShortfall: number
  markets: Record<string, number>
}

/** Reports what the live catalogue plus the proposal would deliver. */
export function summariseProposedCoverage(
  departments: ProposedDepartment[],
  services: ProposedService[],
  existing: ExistingCatalogue,
): ProposedCoverage {
  const markets: Record<string, number> = {}
  for (const service of services) {
    for (const market of service.markets) {
      markets[market] = (markets[market] || 0) + 1
    }
  }

  const liveServices = existing.departments.reduce((sum, d) => sum + d.jobs.length, 0)
  const resultingDepartments = existing.departments.length + departments.length
  const resultingServices = liveServices + services.length

  return {
    liveDepartments: existing.departments.length,
    liveServices,
    proposedDepartments: departments.length,
    proposedServices: services.length,
    resultingDepartments,
    resultingServices,
    targetDepartments: CATALOGUE_TARGETS.departments,
    targetServices: CATALOGUE_TARGETS.serviceJobs,
    servicesShortfall: Math.max(0, CATALOGUE_TARGETS.serviceJobs - resultingServices),
    markets,
  }
}
