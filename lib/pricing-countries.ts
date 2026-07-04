import type { CountryCode, CurrencyCode } from './pricing-types'

export interface CountryPricingConfig {
  code: CountryCode
  currency: CurrencyCode
  symbol: string
  locale: string
  minWagePerHour: number
  avgServiceCallFee: number
  distanceCostPerKm: number
  weekendSurchargePct: number
  nightSurchargePct: number
  holidaySurchargePct: number
  urgencySurchargePct: number
  emergencySurchargePct: number
}

export const COUNTRY_CONFIGS: Record<CountryCode, CountryPricingConfig> = {
  LK: {
    code: 'LK',
    currency: 'LKR',
    symbol: 'Rs.',
    locale: 'si-LK',
    minWagePerHour: 1000,
    avgServiceCallFee: 500,
    distanceCostPerKm: 100,
    weekendSurchargePct: 0.15,
    nightSurchargePct: 0.10,
    holidaySurchargePct: 0.20,
    urgencySurchargePct: 0.15,
    emergencySurchargePct: 0.35,
  },
  CA: {
    code: 'CA',
    currency: 'CAD',
    symbol: 'CAD',
    locale: 'en-CA',
    minWagePerHour: 17.50,
    avgServiceCallFee: 100,
    distanceCostPerKm: 1.50,
    weekendSurchargePct: 0.25,
    nightSurchargePct: 0.15,
    holidaySurchargePct: 0.30,
    urgencySurchargePct: 0.20,
    emergencySurchargePct: 0.40,
  },
}

export function getCountryConfig(code: string): CountryPricingConfig {
  return COUNTRY_CONFIGS[code as CountryCode] || COUNTRY_CONFIGS.LK
}

export function formatPrice(amount: number, countryCode: CountryCode, currency?: CurrencyCode): string {
  const config = getCountryConfig(countryCode)
  const cur = currency || config.currency
  if (cur === 'CAD') {
    return `${config.symbol} ${amount.toFixed(0)}`
  }
  return `${config.symbol} ${Math.round(amount).toLocaleString()}`
}
