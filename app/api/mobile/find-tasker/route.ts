import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSupportedMarket, resolveMarketFromServiceAddress } from '@/lib/geography/market-engine'
import { isBookNowCatalogueAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { matchTaskerCandidates, resolveJobCategoryKeys } from '@/lib/job-matching'
import { getSetting } from '@/lib/settings'
import { findCompanyCandidatesForTemplate } from '@/lib/domain/company-provider-discovery'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const latParam = searchParams.get('latitude')
    const lngParam = searchParams.get('longitude')
    const maxDistParam = searchParams.get('maxDistance')
    const countryParam = searchParams.get('country')

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const templateJob = await prisma.templateJob.findUnique({
      where: { id: jobId },
      include: { category: { select: { id: true, isActive: true, countries: true } } },
    })

    if (!templateJob || !templateJob.isActive) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // A partial GPS pair is not proof of location; reject rather than
    // silently dropping one coordinate and widening provider discovery.
    if ((latParam === null) !== (lngParam === null)) {
      return NextResponse.json({ error: 'Both coordinates are required', code: 'LOCATION_REQUIRES_VERIFICATION' }, { status: 400 })
    }
    const lat = latParam !== null ? Number(latParam) : null
    const lng = lngParam !== null ? Number(lngParam) : null
    if (
      (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) ||
      (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
    ) {
      return NextResponse.json({ error: 'Invalid latitude or longitude' }, { status: 400 })
    }

    const configuredRadius = await getSetting('matching.radius_km', 50)
    const requestedRadius = maxDistParam ? Number(maxDistParam) : configuredRadius
    if (!Number.isFinite(requestedRadius) || requestedRadius <= 0) {
      return NextResponse.json({ error: 'Invalid maxDistance' }, { status: 400 })
    }
    const radiusKm = Math.min(requestedRadius, 100)

    // Phase 03: the browse market must be a supported launch market. A client
    // cannot widen discovery by passing an arbitrary country code.
    const requestedCountry = (countryParam ?? user.countryCode ?? '').trim().toUpperCase()

    if (!isSupportedMarket(requestedCountry)) {
      return NextResponse.json({ error: 'Provider browse is unavailable for this market', code: 'MARKET_NOT_SUPPORTED', candidates: [] }, { status: 200 })
    }

    // Browsing without GPS is a discovery hint, not permission to book.
    // When coordinates are provided they MUST resolve inside the requested
    // launch market (the municipal polygon is authoritative for Vancouver).
    let serviceDistrict: string | null = null
    if (lat !== null && lng !== null) {
      const location = resolveMarketFromServiceAddress({
        latitude: lat, longitude: lng, claimedCountryCode: requestedCountry,
      })
      if (!location.ok || location.countryCode !== requestedCountry) {
        return NextResponse.json({
          error: 'Service location could not be verified for this market',
          code: 'LOCATION_MARKET_MISMATCH',
          candidates: [],
        }, { status: 400 })
      }
      serviceDistrict = location.district || null
    }

    // TemplateJob IDs are not sufficient market authorization. Inactive,
    // foreign-currency and dual-market single-price jobs cannot produce
    // provider suggestions, even via this legacy browse compatibility route.
    if (!templateJob.category ||
        !isBookNowCatalogueAvailableInMarket(templateJob, templateJob.category, requestedCountry as 'LK' | 'CA')) {
      return NextResponse.json({
        error: 'Service is not available in this market',
        code: 'SERVICE_MARKET_UNAVAILABLE',
        candidates: [],
      }, { status: 200 })
    }

    const { keys } = await resolveJobCategoryKeys(templateJob.category.id)
    const candidates = await matchTaskerCandidates({
      matchKeys: keys,
      lat,
      lng,
      radiusKm,
      countryCode: requestedCountry,
    })

    // Same catalogue+market controls as individual browse. Company discovery
    // additionally checks active ownership, credentials and service-area
    // capability through the canonical eligibility engine. A preview is
    // non-binding: V2 job creation enforces the final service-address checks.
    const companies = await findCompanyCandidatesForTemplate({
      templateJobId: templateJob.id,
      categoryId: templateJob.category.id,
      countryCode: requestedCountry as 'LK' | 'CA',
      latitude: lat,
      longitude: lng,
      district: serviceDistrict,
      radiusKm,
    })

    return NextResponse.json([
      ...candidates.map((c) => ({
        id: c.profile.id,
        userId: c.profile.userId,
        name: c.profile.user.name,
        bio: c.profile.bio || '',
        rating: c.profile.rating,
        completedJobs: c.profile.completedJobs,
        isVerified: c.profile.isVerified,
        isOnline: c.profile.isOnline,
        profileImage: c.profile.profileImage,
        // Exact distance and the distance-weighted score can be probed from
        // multiple client-chosen coordinates to triangulate a provider's GPS.
        // Keep the legacy keys nullable for mobile compatibility; candidate
        // ordering is still calculated server-side.
        distance: null,
        score: null,
        skills: c.skills,
        hourlyRate: c.profile.hourlyRate,
        fixedRate: 0,
        experienceYears: 0,
      })),
      ...companies,
    ])
  } catch (error) {
    secureConsole.error('Find tasker error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}