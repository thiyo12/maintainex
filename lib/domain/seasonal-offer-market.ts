import { isCatalogAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'
import { parseNonNegativeMajorUnitPrice } from '@/lib/shared/money/money'

/**
 * Phase 08: seasonal badges must not bypass the canonical service catalogue's
 * launch market, publication or currency rules. This is display filtering,
 * not authority to book a service or set its commercial price.
 */
export function isSeasonalOfferJobAvailableInMarket(
  item: {
    currency: string
    price?: number | null
    templateJob: {
      isActive: boolean
      currency: string
      countries: string
      category: { isActive: boolean; countries: string }
    } | null
  },
  country: string,
): boolean {
  const currency = country === 'CA' ? 'CAD' : country === 'LK' ? 'LKR' : null
  if (!currency) return false
  const job = item.templateJob
  if (!job || !job.isActive || !job.category?.isActive) return false
  if (job.currency !== currency || item.currency !== currency) return false
  if (!isCatalogAvailableInMarket(job.countries, country as 'LK' | 'CA')) return false
  if (!isCatalogAvailableInMarket(job.category.countries, country as 'LK' | 'CA')) return false

  // A configured seasonal override is a price, not untrusted freeform text.
  // Do not expose an override that cannot be represented in minor units.
  if (item.price != null && parseNonNegativeMajorUnitPrice(item.price, currency) === null) return false
  return true
}
