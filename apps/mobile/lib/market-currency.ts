/** LKR and CAD are independent price domains; no FX conversions are permitted. */
export type LaunchCurrency = 'LKR' | 'CAD'

export function currencyForJobCountry(countryCode: string | null | undefined): LaunchCurrency | null {
  if (countryCode?.trim().toUpperCase() === 'LK') return 'LKR'
  if (countryCode?.trim().toUpperCase() === 'CA') return 'CAD'
  return null
}

/** Strict mobile counteroffer amount. Never use parseInt (truncates decimals and garbage). */
export function parseCounterofferAmount(raw: string): number | null {
  const normalized = raw.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null
  const minorUnits = Math.round(value * 100)
  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) return null
  return minorUnits / 100
}

export function quoteMatchesJobCurrency(
  jobCountryCode: string | null | undefined,
  quoteCurrency: string | null | undefined,
): boolean {
  const marketCurrency = currencyForJobCountry(jobCountryCode)
  return marketCurrency !== null && quoteCurrency === marketCurrency
}
