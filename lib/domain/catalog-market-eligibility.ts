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
