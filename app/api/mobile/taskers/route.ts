import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { jsonArrayContains, safeParseJsonArr } from '@/lib/db-utils'
import { isSupportedMarket } from '@/lib/geography/market-engine'
import { toBroadCoverageAreas } from '@/lib/domain/provider-profile-visibility'
import { isCatalogAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'

// List taskers (public-ish, requires auth)
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const area = searchParams.get('area')
    const isOnline = searchParams.get('isOnline')
    const requestedCountry = searchParams.get('country')

    // Phase 03: a customer must only ever see providers in the market they are
    // actually shopping in. Previously this directory applied no market filter at
    // all, so providers from every market — with coordinates, rates and contact
    // details — were listed to any authenticated caller.
    const market = resolveDirectoryMarket(requestedCountry, user.countryCode)
    if (!market) {
      return NextResponse.json(
        {
          error: 'Provider directory is unavailable for this market',
          code: 'MARKET_NOT_SUPPORTED',
          taskers: [],
        },
        { status: 200 },
      )
    }

    const where: any = {
      isVerified: true,
      verificationStatus: 'VERIFIED',
      // A verified profile owned by a suspended, banned, or inactive account
      // is NOT an eligible provider and must not appear in discovery.
      user: { isActive: true, isSuspended: false, isBanned: false },
      // TaskerProfile carries the provider market; fall back to the owning
      // account's market for legacy profiles that predate the field.
      OR: [{ countryCode: market }, { countryCode: null, user: { countryCode: market } }],
    }
    if (isOnline === 'true') where.isOnline = true

    let taskers = await prisma.taskerProfile.findMany({
      where,
      include: {
        // Public directory responses never need account contact details.
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
    })

    if (category) {
      const matchKeys = await resolveCategoryMatchKeys(category, market as 'LK' | 'CA')
      if (matchKeys.length === 0) {
        // An unknown, inactive or unpriced category cannot turn a filtered
        // request into an unrestricted provider directory.
        return NextResponse.json([])
      }
      taskers = taskers.filter(t => {
        const skills = safeParseJsonArr(t.skills)
        return skills.some(s => matchKeys.includes(s))
      })
    }
    if (area) {
      taskers = taskers.filter(t => jsonArrayContains(t.serviceAreas, area))
    }

    return NextResponse.json(
      taskers.map(t => ({
        id: t.id,
        userId: t.userId,
        bio: t.bio,
        hourlyRate: t.hourlyRate,
        skills: safeParseJsonArr(t.skills),
        // Free-form provider-entered areas can contain street addresses.
        // Return broad city/district labels only.
        serviceAreas: toBroadCoverageAreas(safeParseJsonArr(t.serviceAreas)),
        rating: t.rating,
        completedJobs: t.completedJobs,
        isVerified: t.isVerified,
        isOnline: t.isOnline,
        // Exact provider GPS is available only from the authorized,
        // time-bound job tracking endpoint, never from browse results.
        user: { id: t.user.id, name: t.user.name },
      }))
    )
  } catch (error) {
    secureConsole.error('Taskers list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

async function resolveCategoryMatchKeys(category: string, market: 'LK' | 'CA'): Promise<string[]> {
  const expectedCurrency = market === 'LK' ? 'LKR' : 'CAD'
  const otherMarket = market === 'LK' ? 'CA' : 'LK'

  // The original code seeded unknown IDs into the allowed skill keys, and
  // skipped filtering when no category record existed. Both outcomes could
  // return unrelated providers for an invalid or inactive service.
  const jobCat = await prisma.jobCategory.findFirst({
    where: { OR: [{ id: category }, { slug: category }] },
    select: { id: true, slug: true, name: true, isActive: true, countries: true },
  })

  // A linked V2 department must have at least one active, correctly priced,
  // single-market service before its providers can be discovered.
  const categoryBookable = async (c: {
    id: string; isActive: boolean; countries: string
  }): Promise<boolean> => {
    if (!c.isActive || !isCatalogAvailableInMarket(c.countries, market)) return false
    const services = await prisma.templateJob.findMany({
      where: { categoryId: c.id, isActive: true },
      select: { currency: true, countries: true },
    })
    return services.some(service =>
      service.currency === expectedCurrency &&
      isCatalogAvailableInMarket(service.countries, market) &&
      !isCatalogAvailableInMarket(service.countries, otherMarket))
  }

  if (jobCat) {
    if (!(await categoryBookable(jobCat))) return []
    const keys = new Set<string>([jobCat.id, ...(jobCat.slug ? [jobCat.slug] : [])])
    const legacy = await prisma.category.findMany({
      where: { isActive: true }, select: { name: true, slug: true },
    })
    for (const c of legacy) {
      if (c.name.toLowerCase().includes(jobCat.name.toLowerCase()) ||
          jobCat.name.toLowerCase().includes(c.name.toLowerCase())) {
        keys.add(c.slug)
      }
    }
    return [...keys]
  }

  // Keep historical skill slugs, but only when they map to an eligible V2
  // department. Unmapped legacy/unknown input must never widen discovery.
  const legacyCat = await prisma.category.findFirst({
    where: { OR: [{ id: category }, { slug: category }], isActive: true },
    select: { name: true, slug: true },
  })
  if (!legacyCat) return []

  const candidates = await prisma.jobCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, isActive: true, countries: true },
  })
  const keys = new Set<string>()
  for (const jc of candidates) {
    if (!legacyCat.name.toLowerCase().includes(jc.name.toLowerCase()) &&
        !jc.name.toLowerCase().includes(legacyCat.name.toLowerCase())) continue
    if (!(await categoryBookable(jc))) continue
    if (legacyCat.slug) keys.add(legacyCat.slug)
    keys.add(jc.id)
    if (jc.slug) keys.add(jc.slug)
  }
  return [...keys]
}

/**
 * Resolves which market's providers a directory listing may expose.
 * An explicitly requested market must be a supported launch market; otherwise
 * the caller's account market is used. Anything unsupported fails closed so the
 * directory can never fall back to listing every market.
 */
function resolveDirectoryMarket(
  requestedCountry: string | null,
  accountCountry: string | null | undefined,
): string | null {
  const requested = (requestedCountry || '').trim().toUpperCase()
  if (requested) return isSupportedMarket(requested) ? requested : null
  const account = (accountCountry || '').trim().toUpperCase()
  return isSupportedMarket(account) ? account : null
}
