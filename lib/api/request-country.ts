import { getRegionFromHost } from '@/lib/regions'

/**
 * Resolves the requested launch market for a public request.
 *
 * An explicit `country` query parameter wins, otherwise the market is derived
 * from the request host (ca.maintainex.lk -> CA, otherwise LK). Callers must
 * still validate the result with `isSupportedMarket` before treating it as a
 * launch market.
 *
 * Shared so public catalogue/offers routes do not each re-implement this.
 */
export function requestCountry(request: Request): string {
  const requested = new URL(request.url).searchParams.get('country')?.trim().toUpperCase()
  if (requested && /^[A-Z]{2}$/.test(requested)) return requested
  return getRegionFromHost(request.headers.get('host') || '')
}
