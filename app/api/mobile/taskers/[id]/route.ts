import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'
import { decideProfileVisibility, toBroadCoverageAreas } from '@/lib/domain/provider-profile-visibility'
import { requireJobMarket, getMarketConfig } from '@/lib/geography/market-engine'

async function serializeTasker(tasker: any, reduced: boolean) {
  const identity = await prisma.providerIdentity.findUnique({
    where: {
      identityType_subjectId: {
        identityType: 'TASKER',
        subjectId: tasker.id,
      },
    },
    select: {
      kycStatus: true,
      verifiedPhotoUrl: true,
      photoLocked: true,
    },
  })

  const identityVerified =
    tasker.isVerified === true &&
    tasker.verificationStatus === 'VERIFIED' &&
    identity?.kycStatus === 'VERIFIED'

  // Phase 03: the reduced profile carries public identity only. Coordinates,
  // contact details, rates, service areas, availability, identity artefacts and
  // reviewer identities are omitted entirely rather than nulled, so they cannot
  // be inferred by a client.
  const publicProfile = {
    id: tasker.id,
    name: tasker.user?.name || '',
    bio: tasker.bio || '',
    rating: tasker.rating,
    completedJobs: tasker.completedJobs,
    skills: safeParseJsonArr(tasker.skills),
    marketLabel: getMarketConfig(tasker.countryCode || tasker.user?.countryCode)?.label || null,
  }

  if (reduced) {
    return { ...publicProfile, visibility: 'REDUCED' as const }
  }

  // Same-market commercial information. The verified identity photo and any KYC
  // artefact are deliberately NOT returned here, even for an authorised
  // transaction: identity documents are never public profile content.
  return {
    ...publicProfile,
    visibility: 'PUBLIC' as const,
    userId: tasker.userId,
    isVerified: tasker.isVerified,
    isOnline: tasker.isOnline,
    hourlyRate: tasker.hourlyRate,
    // Broad, approved coverage only — never coordinates or exact addresses.
    coverageAreas: toBroadCoverageAreas(tasker.serviceAreas),
    completionRate: tasker.completionRate,
    avgResponseMin: tasker.avgResponseMin,
    profileImage: tasker.profileImage || null,
    user: { id: tasker.user.id, name: tasker.user.name, nickname: tasker.user.nickname },
    reviews: tasker.reviews.map((review: any) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    })),
  }
}

// Customer/provider-safe tasker profile. Private KYC documents and identifiers
// are never returned from this endpoint.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const viewer = await authenticateRequest(request)
    if (!viewer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const include = {
      // Restriction flags and market are selected for the server-side
      // visibility decision only; the response returns an explicit safe user
      // shape so they are never echoed back to the client.
      user: {
        select: {
          id: true, name: true, nickname: true,
          countryCode: true, isActive: true, isSuspended: true,
          suspendedUntil: true, isBanned: true,
        },
      },
      reviews: {
        include: { reviewer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' as const },
        take: 20,
      },
    }

    const tasker =
      await prisma.taskerProfile.findUnique({ where: { id }, include }) ||
      await prisma.taskerProfile.findUnique({ where: { userId: id }, include })

    if (!tasker) {
      return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })
    }

    // Phase 03: suspended, banned, inactive or unverified providers must not be
    // publicly discoverable through this endpoint — not even as a reduced
    // profile. They return 404, matching /api/mobile/find-tasker/[id].
    //
    // Self-access is preserved: a provider may still read their own profile
    // here, and the dedicated /api/mobile/taskers/profile routes are untouched.
    const isSelf = tasker.userId === viewer.id
    const restricted =
      tasker.isVerified !== true ||
      tasker.user?.isBanned === true ||
      tasker.user?.isActive === false ||
      (tasker.user?.isSuspended === true &&
        (!tasker.user?.suspendedUntil || tasker.user.suspendedUntil > new Date()))

    if (restricted && !isSelf) {
      return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })
    }

    // A client may PROPOSE a browsing job id. The server proves the viewer is
    // authorised on it before trusting its market for eligibility.
    const requestedJobId = new URL(request.url).searchParams.get('jobId')
    let proposedContext: { id: string; countryCode: string } | null = null
    if (requestedJobId) {
      const proposed = await prisma.marketplaceJob.findUnique({
        where: { id: requestedJobId },
        select: { id: true, customerId: true, countryCode: true, latitude: true, longitude: true, status: true },
      })
      if (
        proposed &&
        proposed.customerId === viewer.id &&
        ['OPEN', 'QUOTE_ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(proposed.status)
      ) {
        const market = requireJobMarket(proposed)
        if (market.ok) proposedContext = { id: proposed.id, countryCode: market.countryCode }
      }
    }

    const quotedJobs = await prisma.jobQuote.findMany({
      where: { providerId: tasker.userId },
      select: { jobId: true },
    })
    const quotedJobIds = [...new Set(quotedJobs.map(q => q.jobId))]

    const viewerJobs = await prisma.marketplaceJob.findMany({
      where: {
        // Provider quote history is not viewer authorization. The viewer must
        // own the job before it can grant a service market context.
        customerId: viewer.id,
        status: { in: ['OPEN', 'QUOTE_ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      select: { id: true, countryCode: true, latitude: true, longitude: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    })

    let transactionMarket: string | null = proposedContext?.countryCode ?? null
    let activeJobId: string | null = proposedContext?.id ?? null
    if (!proposedContext) {
      for (const job of viewerJobs) {
        const market = requireJobMarket(job)
        if (market.ok) {
          transactionMarket = market.countryCode
          activeJobId = job.id
          break
        }
      }
    }

    const decision = decideProfileVisibility(
      {
        providerCountry: tasker.countryCode || tasker.user?.countryCode,
        providerRestricted: restricted && !isSelf,
      },
      {
        hasAuthorizedServiceContext: activeJobId !== null,
        // A job owned by the viewer provides same-market PUBLIC visibility;
        // only this provider's quote on THAT owned job makes it a transaction.
        hasActiveTransactionWithProvider: activeJobId !== null && quotedJobIds.includes(activeJobId),
        transactionMarket,
      },
    )

    return NextResponse.json(await serializeTasker(tasker, decision.visibility === 'REDUCED'))
  } catch (error) {
    secureConsole.error('Tasker get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
