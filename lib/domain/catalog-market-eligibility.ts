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
  const otherMarket = market === 'CA' ? 'LK' : 'CA'
  return (
    job.isActive &&
    !job.isCompanyOnly &&
    category.isActive &&
    job.currency === expectedCurrency &&
    isCatalogAvailableInMarket(job.countries, market) &&
    // A service has only one TemplateJob currency. Granting a single-priced
    // job to both markets makes it fail booking checks after provider onboarding.
    !isCatalogAvailableInMarket(job.countries, otherMarket) &&
    isCatalogAvailableInMarket(category.countries, market)
  )
}


/**
 * Phase 01: direct BOOK_NOW uses the same market grants as public discovery.
 * A live service ID cannot be booked across borders, nor priced in a foreign
 * currency. A single priced TemplateJob cannot represent both LKR and CAD.
 */
export function isBookNowCatalogueAvailableInMarket(
  job: { isActive: boolean; countries: string; currency: string },
  category: { isActive: boolean; countries: string },
  market: 'LK' | 'CA',
): boolean {
  const currency = market === 'LK' ? 'LKR' : 'CAD'
  const otherMarket = market === 'LK' ? 'CA' : 'LK'
  return job.isActive && category.isActive && job.currency === currency &&
    isCatalogAvailableInMarket(job.countries, market) &&
    !isCatalogAvailableInMarket(job.countries, otherMarket) &&
    isCatalogAvailableInMarket(category.countries, market)
}
