/**
 * DEPRECATED — Simplified matcher used by find-tasker route.
 * Use canonical `lib/matching/index.ts` → findCandidates() instead.
 *保留 for backward compatibility with find-tasker route only.
 * @deprecated since Phase 10.2
 */
import { prisma } from './prisma'
import { isSupportedMarket, resolveMarketFromServiceAddress } from './geography/market-engine'
import { getSetting } from './settings'
import { haversineKm } from './distance'

export interface MatchCandidate {
  profile: {
    id: string
    userId: string
    bio: string | null
    hourlyRate: number
    skills: string | null
    serviceAreas: string | null
    rating: number
    completedJobs: number
    isVerified: boolean
    isOnline: boolean
    profileImage: string | null
    latitude: number | null
    longitude: number | null
    serviceRadius: number | null
    compositeScore: number
    user: {
      id: string
      name: string | null
      email: string
      pushToken: string | null
      isActive: boolean
      isSuspended: boolean
      suspendedUntil: Date | null
      isBanned: boolean
    }
  }
  skills: string[]
  distanceKm: number | undefined
  score: number
}

export function parseSkills(val: string | null | undefined): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed.map((s: any) => String(s)) : []
  } catch {
    return val.split(',').map((s) => s.trim()).filter(Boolean)
  }
}

export async function resolveJobCategoryKeys(categoryIdOrSlug: string): Promise<{ keys: string[]; name: string }> {
  const byId = await prisma.jobCategory.findUnique({ where: { id: categoryIdOrSlug } })
  if (byId) {
    return { keys: [byId.id, ...(byId.slug ? [byId.slug] : []), byId.name], name: byId.name }
  }
  const bySlug = await prisma.jobCategory.findUnique({ where: { slug: categoryIdOrSlug } })
  if (bySlug) {
    return { keys: [bySlug.id, bySlug.slug!, bySlug.name], name: bySlug.name }
  }
  const legacy = await prisma.category.findUnique({ where: { id: categoryIdOrSlug } })
  if (legacy?.slug) {
    return { keys: [legacy.slug, legacy.name].filter(Boolean), name: legacy.name }
  }
  return { keys: [categoryIdOrSlug.toLowerCase()], name: '' }
}

interface MatchInput {
  matchKeys: string[]
  lat?: number | null
  lng?: number | null
  radiusKm?: number
  targetTaskerId?: string
  countryCode?: string
  maxResults?: number
}

async function busyProviderIds(): Promise<Set<string>> {
  const activeJobs = await prisma.marketplaceJob.findMany({
    where: { status: 'IN_PROGRESS' },
    select: { id: true },
  })
  if (activeJobs.length === 0) return new Set()
  const quotes = await prisma.jobQuote.findMany({
    where: { jobId: { in: activeJobs.map((j) => j.id) }, status: 'ACCEPTED' },
    select: { providerId: true },
  })
  return new Set(quotes.map((q) => q.providerId))
}

export async function matchTaskerCandidates(input: MatchInput): Promise<MatchCandidate[]> {
  const radiusKm = input.radiusKm ?? (await getSetting('matching.radius_km', 50))
  const targeted = !!input.targetTaskerId

  // Phase 03: a browse request with no established market must return nobody.
  // Previously the country filter was dropped entirely when countryCode was
  // falsy, listing online providers from every launch market.
  const market = (input.countryCode || '').trim().toUpperCase()
  const marketFilter = isSupportedMarket(market) ? { countryCode: market } : { countryCode: '__none__' }
  const hasCoords = input.lat != null && input.lng != null
  const hasAnyCoords = input.lat != null || input.lng != null

  // The old browse API checks the requested address, but this exported
  // matcher has other possible callers. Invalid radius and incomplete GPS
  // must never downgrade into unrestricted no-location discovery.
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return []
  if (hasAnyCoords) {
    if (!hasCoords || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return []
    const resolved = resolveMarketFromServiceAddress({
      latitude: input.lat,
      longitude: input.lng,
      claimedCountryCode: market,
    })
    if (!resolved.ok || resolved.countryCode !== market) return []
  }

  const allProfiles = await prisma.taskerProfile.findMany({
    where: targeted
      ? {
          userId: input.targetTaskerId!,
          isVerified: true,
          verificationStatus: 'VERIFIED',
          ...marketFilter,
        }
      : {
          isOnline: true,
          isVerified: true,
          verificationStatus: 'VERIFIED',
          ...marketFilter,
        },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          pushToken: true,
          isActive: true,
          isSuspended: true,
          suspendedUntil: true,
          isBanned: true,
        },
      },
    },
  })

  const busy = await busyProviderIds()

  const candidates: MatchCandidate[] = []

  for (const p of allProfiles) {
    if (!p.user.isActive || p.user.isBanned) continue
    if (p.user.isSuspended && (!p.user.suspendedUntil || p.user.suspendedUntil > new Date())) continue
    if (process.env.ALLOW_TEST_OTP !== 'true' && p.user.email.endsWith('@maintainex-test.lk')) continue
    if (!targeted && busy.has(p.userId)) continue

    const skills = parseSkills(p.skills)
    if (!skills.some((s) => input.matchKeys.includes(s))) continue

    // Do not pass a GPS-targeted search by skipping the distance check.
    // Providers with absent, partial or corrupt coordinates have no verified
    // distance and cannot satisfy a radius-constrained match.
    if (hasCoords && (
      p.latitude == null || p.longitude == null ||
      !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) ||
      p.latitude < -90 || p.latitude > 90 ||
      p.longitude < -180 || p.longitude > 180
    )) continue

    let distanceKm: number | undefined
    let distScore = 0
    if (hasCoords) {
      distanceKm = haversineKm(input.lat!, input.lng!, p.latitude!, p.longitude!)
      const effectiveRadius = Math.min(radiusKm, p.serviceRadius ?? radiusKm)
      if (distanceKm > effectiveRadius) continue
      distScore = Math.max(0, 1 - distanceKm / Math.max(radiusKm, 1))
    }

    const ratingScore = (p.rating || 0) * 0.4
    const completionScore = Math.min((p.completedJobs || 0) / 20, 1) * 0.2
    const repScore = ((p.compositeScore || 50) / 100) * 0.1
    const score = ratingScore + completionScore + distScore * 0.3 + repScore

    candidates.push({ profile: p, skills, distanceKm, score })
  }

  candidates.sort((a, b) =>
    b.score - a.score || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  )

  return input.maxResults ? candidates.slice(0, input.maxResults) : candidates
}