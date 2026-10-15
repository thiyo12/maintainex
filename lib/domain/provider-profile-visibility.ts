/**
 * Provider profile visibility (Phase 03).
 *
 * Three tiers, so a customer can evaluate an eligible provider before booking
 * while cross-market viewers still receive nothing sensitive.
 *
 *  PUBLIC     — same-market eligible viewer. Normal commercial information:
 *               name, public avatar, bio, skills, aggregate rating, approved
 *               public reviews, published rates and availability.
 *  TRANSACTION— same-market viewer with an active job involving this provider.
 *               Adds only the job-specific reference needed to manage that
 *               transaction. Never adds private or KYC material.
 *  REDUCED    — out-of-market viewer, or a viewer whose own market cannot be
 *               established. Public identity and aggregate reputation only.
 *
 * Market eligibility comes from validated service-location context only: an
 * authorized job whose service address resolves inside a launch market. Account
 * country is not evidence. A client-supplied country parameter is never
 * consulted; a client-supplied job id is accepted only after the server confirms
 * the viewer is authorised on that job.
 *
 * Never exposed at any tier: contact details, precise coordinates, KYC or
 * identity-document images, reviewer identities, or internal account status.
 */

export type ProfileVisibility = 'PUBLIC' | 'TRANSACTION' | 'REDUCED'

export interface ProviderVisibilityFacts {
  /** Provider's own market, resolved server-side. */
  providerCountry: string | null
  /** Provider suspended/banned/inactive — existing restrictions are preserved. */
  providerRestricted: boolean
}

export interface ViewerMarketEvidence {
  /**
   * True only when the viewer holds an AUTHORIZED job whose service address
   * resolves inside a launch market. Account country is deliberately NOT
   * accepted here: it is not validated service-location context.
   */
  hasAuthorizedServiceContext: boolean
  /** True when that job involves THIS provider specifically. */
  hasActiveTransactionWithProvider: boolean
  /** Authoritative market of the authorized job, when it resolves. */
  transactionMarket: string | null
}

export interface VisibilityDecision {
  visibility: ProfileVisibility
  reason:
    | 'SAME_MARKET_ACTIVE_TRANSACTION'
    | 'SAME_MARKET_PUBLIC'
    | 'PROVIDER_RESTRICTED'
    | 'CROSS_MARKET'
    | 'VIEWER_MARKET_UNVERIFIED'
}

/**
 * Decides how much of a provider profile a viewer may see.
 *
 * A restricted provider is never widened by this policy: existing 404 handling
 * for banned/suspended providers stays in the routes, and any provider that
 * still reaches this function is reduced rather than expanded.
 */
export function decideProfileVisibility(
  facts: ProviderVisibilityFacts,
  viewer: ViewerMarketEvidence,
): VisibilityDecision {
  if (facts.providerRestricted) {
    return { visibility: 'REDUCED', reason: 'PROVIDER_RESTRICTED' }
  }

  const providerCountry = (facts.providerCountry || '').trim().toUpperCase()
  if (!providerCountry) {
    return { visibility: 'REDUCED', reason: 'VIEWER_MARKET_UNVERIFIED' }
  }

  // Only a validated service-location context authorises browsing. This codebase
  // has no saved-address model and the account carries no address, so an
  // authorized job is the sole trusted source. Account country is never enough.
  if (!viewer.hasAuthorizedServiceContext) {
    return { visibility: 'REDUCED', reason: 'VIEWER_MARKET_UNVERIFIED' }
  }

  const viewerMarket = (viewer.transactionMarket || '').trim().toUpperCase()

  if (!viewerMarket) {
    return { visibility: 'REDUCED', reason: 'VIEWER_MARKET_UNVERIFIED' }
  }

  if (viewerMarket !== providerCountry) {
    return { visibility: 'REDUCED', reason: 'CROSS_MARKET' }
  }

  if (viewer.hasActiveTransactionWithProvider) {
    return { visibility: 'TRANSACTION', reason: 'SAME_MARKET_ACTIVE_TRANSACTION' }
  }

  return { visibility: 'PUBLIC', reason: 'SAME_MARKET_PUBLIC' }
}

/** Public fields present in every tier. */
export interface PublicProviderProfile {
  /** Public provider profile id. Deliberately NOT the private account id. */
  id: string
  name: string
  bio: string
  rating: number
  completedJobs: number
  skills: string[]
  /** Broad market label only, e.g. "Sri Lanka". Never coordinates. */
  marketLabel: string | null
}

/** Strips a full payload down to the always-safe public contract. */
export function redactProviderProfile(full: Record<string, unknown>): PublicProviderProfile {
  return {
    id: String(full.id ?? ''),
    name: String(full.name ?? ''),
    bio: String(full.bio ?? ''),
    rating: Number(full.rating ?? 0),
    completedJobs: Number(full.completedJobs ?? 0),
    skills: Array.isArray(full.skills) ? (full.skills as string[]) : [],
    marketLabel: full.marketLabel ? String(full.marketLabel) : null,
  }
}

/**
 * Fields that must never appear in ANY tier, including an authorised
 * transaction tier. Contact details, precise location, KYC artefacts and
 * reviewer identities are excluded even from same-market responses.
 */
export const NEVER_PUBLIC_FIELDS = [
  'phone',
  'email',
  'latitude',
  'longitude',
  'distance',
  'distanceKm',
  'distanceMinutes',
  'locationUpdatedAt',
  'verifiedPhotoUrl',
  'profilePhotoVerified',
  'identityStatus',
  'identityVerified',
  'kycStatus',
  'verificationStatus',
  'verificationNote',
  'reviewerName',
  'isBanned',
  'isSuspended',
  'suspendedUntil',
  'isActive',
  'bookingEligible',
] as const

/** Fields excluded from REDUCED but permitted for same-market viewers. */
export const COMMERCIAL_FIELDS = [
  'userId',
  'profileImage',
  'isVerified',
  'isOnline',
  'hourlyRate',
  'fixedRate',
  'startingPrice',
  'reviews',
  'coverageAreas',
  'avgResponseMin',
  'completionRate',
  'onTimeRate',
  'cancellationRate',
  'repeatClientRate',
  'activeJobId',
] as const

export type FieldCheck = keyof Record<string, unknown>

/**
 * Returns any field that must not be present for the given tier.
 * Used by tests to assert redaction rather than assume it.
 */
export function leakedFields(
  payload: Record<string, unknown>,
  visibility: ProfileVisibility,
): string[] {
  const forbidden =
    visibility === 'REDUCED' ? [...NEVER_PUBLIC_FIELDS, ...COMMERCIAL_FIELDS] : [...NEVER_PUBLIC_FIELDS]
  return forbidden.filter(field => field in payload)
}

/**
 * Reduces a provider's own coverage entries to broad geographic labels.
 *
 * `serviceAreas` is free text supplied by the provider (see the taskers/profile
 * update route), so it can contain "42/3 Temple Road" or a coordinate string.
 * Only plain city/district style names are ever exposed; anything resembling an
 * address, a numbered locality, a postal code or a coordinate is dropped.
 *
 * No geography is invented or remapped — an entry is either already a broad
 * label or it is withheld.
 */
const ADDRESS_LIKE =
  /\b(road|rd|street|st|lane|ln|avenue|ave|boulevard|blvd|lane|highway|hwy|drive|dr|place|pl|square|sq|apartment|flat|floor|shop|building|no\.?|number|plot|block|sector|phase|pin|postal|postcode|zip|gps|latitude|longitude|lat|lng|lon|coordinate|near|opposite|beside|behind|next to)\b/i

export function toBroadCoverageAreas(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  const out: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const value = entry.trim().replace(/\s+/g, ' ')
    if (value.length < 2 || value.length > 40) continue
    // Digits indicate a numbered locality, house number, postal or coordinate.
    if (/[0-9]/.test(value)) continue
    if (ADDRESS_LIKE.test(value)) continue
    // Only letters, spaces and light punctuation may remain.
    if (!/^[A-Za-z][A-Za-z\s\-'.()&]*$/.test(value)) continue
    const label = value.replace(/\s*\([^)]*\)\s*$/, '').trim() || value
    const deduped = label.length >= 2 ? label : value
    if (!out.some(existing => existing.toLowerCase() === deduped.toLowerCase())) {
      out.push(deduped)
    }
    if (out.length >= 20) break
  }
  return out
}
