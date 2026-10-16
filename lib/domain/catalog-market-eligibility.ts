/**
 * V2 catalogue eligibility by market.
 * JobCategory.countries and TemplateJob.countries are JSON-encoded arrays in
 * the existing schema. Malformed or missing grants must fail closed.
 *
 * Discovery visibility is not booking authorization: booking must independently
 * enforce service address, assigned provider and payment country.
 */
export function isCatalogAvailableInMarket(storedCountries: string, market: 'LK' | 'CA'): boolean {
  try {
    const parsed: unknown = JSON.parse(storedCountries)
    return Array.isArray(parsed) &&
      parsed.every(code => typeof code === 'string') &&
      parsed.includes(market)
  } catch {
    return false
  }
}

/**
 * Phase 04: canonical V2 jobs available to an individual provider in their
 * authenticated market. Reuse the marketplace catalogue boundary for both
 * the onboarding list and its save endpoint, rather than trusting job IDs.
 */
export function isTaskerServiceAvailableInMarket(
  job: { isActive: boolean; isCompanyOnly: boolean; countries: string; currency: string },
  category: { isActive: boolean; countries: string },
  market: 'LK' | 'CA',
): boolean {
  const expectedCurrency = market === 'CA' ? 'CAD' : 'LKR'
  return (
    job.isActive &&
    !job.isCompanyOnly &&
    category.isActive &&
    job.currency === expectedCurrency &&
    isCatalogAvailableInMarket(job.countries, market) &&
    isCatalogAvailableInMarket(category.countries, market)
  )
}
