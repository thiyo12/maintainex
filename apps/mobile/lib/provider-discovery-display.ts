/**
 * Read-only presentation hints. Never convert a legacy provider rate into
 * CAD: most provider profile rates have no per-market currency provenance.
 * Booking/quote creation still determines the authoritative priced currency.
 */
type PriceCandidate = {
  startingPrice?: unknown
  hourlyRate?: unknown
  minimumPrice?: unknown
  currency?: unknown
}

type ServicePrice = {
  priceMin?: unknown
  priceMax?: unknown
  currency?: unknown
}

export type BrowseMarket = 'LK' | 'CA'

function majorValue(value: unknown): number | null {
  const n = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

function expectedCurrency(market?: string | null): 'LKR' | 'CAD' | null {
  return market === 'LK' ? 'LKR' : market === 'CA' ? 'CAD' : null
}

function formatAmount(value: number, currency: 'LKR' | 'CAD') {
  return `${currency} ${value.toLocaleString('en-US')}`
}

export function providerPriceGuide(
  provider: PriceCandidate | null | undefined,
  service: ServicePrice | null | undefined,
  market?: string | null,
): string {
  const currency = expectedCurrency(market)
  if (!currency) return 'Quote required'

  // Legacy provider rates are LKR only. The Canadian provider must explicitly
  // declare CAD before its numeric rate may be shown in a CAD marketplace.
  const rateCurrency = typeof provider?.currency === 'string'
    ? provider.currency.trim().toUpperCase()
    : null
  const providerRate =
    majorValue(provider?.startingPrice) ??
    majorValue(provider?.hourlyRate) ??
    majorValue(provider?.minimumPrice)
  if (providerRate !== null &&
      (rateCurrency === currency || (currency === 'LKR' && !rateCurrency))) {
    return `Indicative from ${formatAmount(providerRate, currency)} · confirm quote`
  }

  // Template jobs have an explicit currency. Never borrow an LK template's
  // numbers for Vancouver or vice versa, and never invent a CA exchange rate.
  const templateMin = majorValue(service?.priceMin)
  if (service?.currency === currency && templateMin !== null) {
    return `Service guide from ${formatAmount(templateMin, currency)} · confirm quote`
  }
  return 'Quote required'
}

export function directRequestPriceGuide(
  provider: PriceCandidate | null | undefined,
  service: ServicePrice | null | undefined,
  market?: string | null,
): string {
  const guide = providerPriceGuide(provider, service, market)
  const currency = expectedCurrency(market)
  const lo = majorValue(service?.priceMin)
  const hi = majorValue(service?.priceMax)
  if (currency && service?.currency === currency &&
      lo !== null && hi !== null && hi >= lo &&
      !guide.startsWith('Indicative from')) {
    return `Service guide ${formatAmount(lo, currency)}–${formatAmount(hi, currency)} · confirm quote`
  }
  return guide
}

/**
 * API deliberately returns distance: null to avoid GPS triangulation.
 * Number(null) is 0; never display a fabricated "1 m away".
 */
export function providerDistanceLabel(provider: {
  distance?: unknown
  distanceKm?: unknown
}): string {
  const raw = provider.distance ?? provider.distanceKm
  const km = majorValue(raw)
  if (km === null) return 'Distance not shown'
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m away`
  return `${km.toFixed(km < 10 ? 1 : 0)} km away`
}
