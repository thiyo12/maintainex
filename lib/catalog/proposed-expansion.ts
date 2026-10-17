/**
 * PROPOSED service catalogue expansion (Phase 01, Step 3).
 *
 * IMPORTANT: nothing in this file was previously approved. The 27 department /
 * 548 service job figures are a *proposal* recorded in
 * docs/international-launch/MASTER-IMPLEMENTATION-PLAN.md, and an exhaustive
 * search of the repository, every branch, the full git history and all
 * migrations found no approved catalogue artefact to recover.
 *
 * These entries therefore:
 *   - live in a separate proposed dataset, never merged into the live catalogue
 *     by default;
 *   - are always imported with isActive = false;
 *   - are never presented as previously approved;
 *   - carry no Canadian price benchmarks, because none exist and inventing them
 *     would misrepresent the market.
 *
 * Sri Lanka pricing is indicative only and is marked as a proposal for review.
 */

export type ProposedMarket = 'LK' | 'CA'

export type ProposedProviderType = 'INDIVIDUAL' | 'COMPANY' | 'EITHER'

export interface ProposedDepartment {
  name: string
  slug: string
  description: string
  markets: ProposedMarket[]
  iconName: string
  colorHex: string
  sortOrder: number
}

export interface ProposedService {
  name: string
  /** Slug of an existing department or a department proposed in this file. */
  department: string
  description: string
  whatIsIncluded: string[]
  typicalDurationMinutes: number
  markets: ProposedMarket[]
  providerType: ProposedProviderType
  skills: string[]
  /** Licensing or certification a provider must hold for this service. */
  licensing?: { required: boolean; requirement: string }
  /**
   * Indicative Sri Lankan price band in LKR. Canadian entries intentionally have
   * no price band: no verified Canadian benchmark exists.
   */
  priceLKR?: { min: number; max: number }
  status: 'PROPOSED'
}

export interface ProposedSkill {
  slug: string
  name: string
  description: string
  department: string
}

export { PROPOSED_DEPARTMENTS } from './proposed/departments'
export { PROPOSED_SKILLS } from './proposed/skills'
export { PROPOSED_SERVICES } from './proposed/index'



/**
 * Compact constructor for proposed services. Keeping construction in one place
 * makes it impossible to omit `status: 'PROPOSED'`.
 */
export function proposedService(
  name: string,
  department: string,
  typicalDurationMinutes: number,
  markets: ProposedMarket[],
  providerType: ProposedProviderType,
  skills: string[],
  whatIsIncluded: string[],
  priceLKR: [number, number] | null,
  description: string,
  licensing?: { required: boolean; requirement: string },
): ProposedService {
  return {
    name,
    department,
    description,
    whatIsIncluded,
    typicalDurationMinutes,
    markets,
    providerType,
    skills,
    licensing,
    priceLKR: priceLKR ? { min: priceLKR[0], max: priceLKR[1] } : undefined,
    status: 'PROPOSED',
  }
}

/**
 * Project proposed market eligibility into a *single priced market* before any
 * optional database staging. TemplateJob has one currency and one price band.
 * CA-only items have no verified CAD prices; a dual-market LKR row must never
 * be labelled CA, even while inactive. All 309 proposed source records stay
 * intact pending explicit catalogue/price approval.
 */
export function getSafeProposedImportPricing(service: ProposedService):
  | { countries: string; currency: 'LKR'; priceMin: number; priceMax: number }
  | null {
  const price = service.priceLKR
  if (!service.markets.includes('LK') || !price ||
      !Number.isFinite(price.min) || !Number.isFinite(price.max) ||
      price.min < 0 || price.max < price.min) return null
  return {
    countries: JSON.stringify(['LK']),
    currency: 'LKR',
    priceMin: price.min,
    priceMax: price.max,
  }
}

/**
 * Every proposed service is explicitly marked PROPOSED and is imported inactive.
 * This helper exists so no call site can accidentally omit that guarantee.
 */
export function buildProposedImportRows(services?: ProposedService[]) {
  // Defaulted lazily to avoid a circular import between the dataset and helpers.
  const rows: ProposedService[] = services ?? require('./proposed/index').PROPOSED_SERVICES
  return rows.map(service => ({
    ...service,
    status: 'PROPOSED' as const,
    isActive: false,
    // A service that only companies may deliver is company-only in the catalogue.
    isCompanyOnly: service.providerType === 'COMPANY',
  }))
}

export const PROPOSED_CATALOGUE_STATUS = {
  approved: false,
  source: 'proposed-expansion',
  note:
    'Proposed for review. Not previously approved. Imported inactive until signed off.',
} as const
