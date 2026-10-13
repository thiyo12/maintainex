/**
 * Canonical geography / market engine for the international launch.
 *
 * SECURITY RULE (Phase 02): the validated service address is the authoritative
 * basis for market selection. A country parameter, phone number, user
 * preference or IP address must never be the sole authorization decision.
 *
 * Launch scope:
 *  - LK: all 25 districts, currency LKR
 *  - CA: City of Vancouver municipal boundaries only (Toronto, other Canadian
 *    cities and the rest of Metro Vancouver are deliberately NOT enabled)
 *
 * Boundary handling is deliberately fail-closed: an address that cannot be
 * validated inside a launch market is rejected rather than silently defaulted to
 * the default market.
 */

export type CountryCode = 'LK' | 'CA'

export interface MarketConfig {
  countryCode: CountryCode
  label: string
  currency: string
  districts: string[]
  /** Inclusive bounding envelope used as a coarse municipal containment test. */
  bounds: {
    minLatitude: number
    maxLatitude: number
    minLongitude: number
    maxLongitude: number
  }
  postalCodePattern: RegExp
  postalCodeExample: string
}

export const LAUNCH_MARKETS: Record<string, MarketConfig> = {
  LK: {
    countryCode: 'LK',
    label: 'Sri Lanka',
    currency: 'LKR',
    districts: [
      'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
      'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
      'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
      'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
      'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
    ],
    // Sri Lanka landmass envelope.
    bounds: {
      minLatitude: 5.9,
      maxLatitude: 9.9,
      minLongitude: 79.6,
      maxLongitude: 82.0,
    },
    postalCodePattern: /^\d{5}$/,
    postalCodeExample: '00100',
  },
  CA: {
    countryCode: 'CA',
    label: 'Canada',
    currency: 'CAD',
    // Vancouver municipal limits only. Other Metro Vancouver municipalities
    // (Richmond, Burnaby, Surrey, New Westminster...) are intentionally out of
    // launch scope and are rejected by the bounding envelope below.
    districts: ['Vancouver'],
    bounds: {
      minLatitude: 49.2,
      maxLatitude: 49.31,
      minLongitude: -123.29,
      maxLongitude: -122.97,
    },
    postalCodePattern: /^[Vv]\d[A-Za-z]\s?\d[A-Za-z]\d$/,
    postalCodeExample: 'V6B 1A1',
  },
}

export const DEFAULT_MARKET_COUNTRY: CountryCode = 'LK'

export function isSupportedMarket(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false
  return Object.prototype.hasOwnProperty.call(LAUNCH_MARKETS, countryCode.toUpperCase())
}

export function getMarketConfig(countryCode: string | null | undefined): MarketConfig | null {
  if (!isSupportedMarket(countryCode)) return null
  return LAUNCH_MARKETS[countryCode!.toUpperCase()]
}

export function isSupportedDistrict(countryCode: string, district: string | null | undefined): boolean {
  const market = getMarketConfig(countryCode)
  if (!market) return false
  if (!district) return false
  const normalized = district.trim().toLowerCase()
  return market.districts.some(d => d.toLowerCase() === normalized)
}

function withinBounds(config: MarketConfig, latitude: number, longitude: number): boolean {
  const { bounds } = config
  return (
    latitude >= bounds.minLatitude &&
    latitude <= bounds.maxLatitude &&
    longitude >= bounds.minLongitude &&
    longitude <= bounds.maxLongitude
  )
}

export interface ServiceAddressInput {
  latitude?: number | null
  longitude?: number | null
  postalCode?: string | null
  district?: string | null
  /**
   * Client-claimed country. Advisory only: it can never authorize a market and
   * can only be used to disambiguate between launch markets.
   */
  claimedCountryCode?: string | null
}

export type MarketResolution =
  | {
      ok: true
      countryCode: CountryCode
      district: string | null
      source: 'coordinates' | 'postal' | 'coordinates+postal'
    }
  | {
      ok: false
      code:
        | 'ADDRESS_NOT_PROVIDED'
        | 'ADDRESS_OUTSIDE_LAUNCH_GEOGRAPHY'
        | 'ADDRESS_OUTSIDE_MARKET'
        | 'POSTAL_CODE_INVALID'
      error: string
    }

/**
 * Resolves the authoritative market for a service address.
 *
 * Precedence: coordinates (strongest) → postal code + claimed country.
 * Fails closed when the address cannot be proven inside a launch market.
 */
export function resolveMarketFromServiceAddress(input: ServiceAddressInput): MarketResolution {
  const hasCoordinates =
    typeof input.latitude === 'number' &&
    Number.isFinite(input.latitude) &&
    typeof input.longitude === 'number' &&
    Number.isFinite(input.longitude)

  if (hasCoordinates) {
    const latitude = input.latitude as number
    const longitude = input.longitude as number

    const candidates = Object.values(LAUNCH_MARKETS).filter(market =>
      withinBounds(market, latitude, longitude)
    )

    if (candidates.length === 0) {
      return {
        ok: false,
        code: 'ADDRESS_OUTSIDE_LAUNCH_GEOGRAPHY',
        error:
          'Service address is outside the currently supported launch areas (Sri Lanka or City of Vancouver).',
      }
    }

    // Coordinates can only ever narrow to a single launch market.
    const market = candidates[0]
    const postal = (input.postalCode || '').trim()

    if (postal) {
      if (!market.postalCodePattern.test(postal)) {
        return {
          ok: false,
          code: 'POSTAL_CODE_INVALID',
          error: 'Postal code does not match the resolved market.',
        }
      }
      return {
        ok: true,
        countryCode: market.countryCode,
        district: matchDistrict(market, input.district),
        source: 'coordinates+postal',
      }
    }

    return {
      ok: true,
      countryCode: market.countryCode,
      district: matchDistrict(market, input.district),
      source: 'coordinates',
    }
  }

  const postal = (input.postalCode || '').trim()
  if (!postal) {
    return {
      ok: false,
      code: 'ADDRESS_NOT_PROVIDED',
      error:
        'A validated service address (coordinates or postal code) is required to determine the market.',
    }
  }

  const claimed = input.claimedCountryCode ? input.claimedCountryCode.toUpperCase() : null
  const markets = claimed && isSupportedMarket(claimed)
    ? [LAUNCH_MARKETS[claimed]]
    : Object.values(LAUNCH_MARKETS)

  const matched = markets.filter(market => market.postalCodePattern.test(postal))
  if (matched.length === 0) {
    return {
      ok: false,
      code: 'ADDRESS_OUTSIDE_MARKET',
      error: 'Postal code does not match a supported launch market.',
    }
  }

  const market = matched[0]
  return {
    ok: true,
    countryCode: market.countryCode,
    district: matchDistrict(market, input.district),
    source: 'postal',
  }
}

function matchDistrict(market: MarketConfig, district: string | null | undefined): string | null {
  if (!district) return market.districts.length === 1 ? market.districts[0] : null
  const normalized = district.trim().toLowerCase()
  const found = market.districts.find(d => d.toLowerCase() === normalized)
  return found || null
}

/**
 * Authoritative market for an existing job record. Used wherever a stored job
 * drives discovery, quoting, booking, payment or refund decisions so those
 * paths can never be re-pointed by a client-supplied country value.
 */
export function resolveJobMarket(job: {
  countryCode?: string | null
  latitude?: number | null
  longitude?: number | null
}): CountryCode | null {
  const hasCoordinates =
    typeof job.latitude === 'number' &&
    Number.isFinite(job.latitude) &&
    typeof job.longitude === 'number' &&
    Number.isFinite(job.longitude)

  if (hasCoordinates) {
    const resolved = resolveMarketFromServiceAddress({
      latitude: job.latitude,
      longitude: job.longitude,
      claimedCountryCode: job.countryCode,
    })
    // Coordinates are the authority. When they cannot be proven inside a launch
    // market we must fail closed rather than fall back to a stored country code,
    // which is exactly the manipulation this rule exists to prevent.
    return resolved.ok ? resolved.countryCode : null
  }

  if (isSupportedMarket(job.countryCode)) return job.countryCode!.toUpperCase() as CountryCode
  return null
}