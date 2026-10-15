import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'
import {
  decideProfileVisibility,
  toBroadCoverageAreas,
  redactProviderProfile,
} from '@/lib/domain/provider-profile-visibility'
import { requireJobMarket, getMarketConfig } from '@/lib/geography/market-engine'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const searchParams = new URL(request.url).searchParams
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasker = await prisma.taskerProfile.findFirst({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            isActive: true,
            isSuspended: true,
            suspendedUntil: true,
            isBanned: true,
            countryCode: true,
          },
        },
        reviews: {
          include: { reviewer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!tasker) {
      return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })
    }

    const restricted =
      !tasker.isVerified ||
      !tasker.user.isActive ||
      tasker.user.isBanned ||
      (tasker.user.isSuspended &&
        (!tasker.user.suspendedUntil || tasker.user.suspendedUntil > new Date()))
    if (restricted) {
      return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })
    }

    // Phase 03: visibility follows the approved reduced-profile policy.
    const requestedJobId = searchParams.get('jobId')
    const evidence = await resolveViewerEvidence(
      { id: user.id },
      tasker.id,
      requestedJobId,
    )
    const decision = decideProfileVisibility(
      {
        providerCountry: tasker.countryCode || tasker.user.countryCode,
        providerRestricted: false,
      },
      evidence,
    )

    const publicProfile = redactProviderProfile({
      id: tasker.id,
      name: tasker.user.name,
      bio: tasker.bio || '',
      rating: tasker.rating,
      completedJobs: tasker.completedJobs,
      skills: safeParseJsonArr(tasker.skills),
      marketLabel: broadMarketLabel(tasker.countryCode || tasker.user.countryCode),
    })

    if (decision.visibility === 'REDUCED') {
      return NextResponse.json({ ...publicProfile, visibility: 'REDUCED' })
    }

    // Same-market eligible viewers get normal commercial information so they can
    // evaluate the provider before booking. Reviewer identities stay hidden.
    const commercial = {
      userId: tasker.userId,
      isVerified: tasker.isVerified,
      isOnline: tasker.isOnline,
      profileImage: tasker.profileImage,
      hourlyRate: tasker.hourlyRate,
      // Broad, approved coverage only — never coordinates or exact addresses.
      coverageAreas: toBroadCoverageAreas(tasker.serviceAreas),
      reviews: tasker.reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      })),
    }

/**
 * Phase 03: resolves the viewer's own service market from trusted server-side
 * evidence only. A client-supplied country parameter is never consulted, and an
 * account country on its own is not treated as proof of a validated market.
 */
async function resolveViewerEvidence(
  viewer: { id: string },
  providerId: string,
  requestedJobId: string | null,
) {
  // A client may PROPOSE a job id for browsing context, but the server proves
  // the viewer is authorised on it before its market is trusted.
  if (requestedJobId) {
    const proposed = await prisma.marketplaceJob.findUnique({
      where: { id: requestedJobId },
      select: { id: true, customerId: true, countryCode: true, latitude: true, longitude: true, status: true },
    })
    const authorised =
      proposed !== null &&
      proposed.customerId === viewer.id &&
      ACTIVE_PROFILE_JOB_STATUSES.includes(proposed.status)
    if (authorised && proposed) {
      const market = requireJobMarket(proposed)
      if (market.ok) {
        return {
          hasAuthorizedServiceContext: true,
          hasActiveTransactionWithProvider: false,
          transactionMarket: market.countryCode,
          activeJobId: proposed.id,
        }
      }
    }
  }

  // Otherwise fall back to any job this viewer participates in with the
  // provider (owned, or one the provider quoted).
  const quotedJobs = await prisma.jobQuote.findMany({
    where: { providerId },
    select: { jobId: true },
  })
  const quotedJobIds = [...new Set(quotedJobs.map(q => q.jobId))]
  const viewerJobs = await viewerJobsForProvider(viewer.id, quotedJobIds)

  for (const job of viewerJobs) {
    const market = requireJobMarket(job)
    if (market.ok) {
      return {
        hasAuthorizedServiceContext: true,
        hasActiveTransactionWithProvider: true,
        transactionMarket: market.countryCode,
        activeJobId: job.id,
      }
    }
  }

  return {
    hasAuthorizedServiceContext: false,
    hasActiveTransactionWithProvider: false,
    transactionMarket: null,
    activeJobId: null,
  }
}

const ACTIVE_PROFILE_JOB_STATUSES = ['OPEN', 'QUOTE_ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED']

function viewerJobsForProvider(viewerUserId: string, quotedJobIds: string[]) {
  return prisma.marketplaceJob.findMany({
    where: {
      OR: [
        { customerId: viewerUserId },
        ...(quotedJobIds.length > 0 ? [{ id: { in: quotedJobIds } }] : []),
      ],
      status: { in: ['OPEN', 'QUOTE_ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] },
    },
    select: { id: true, countryCode: true, latitude: true, longitude: true },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })
}

function broadMarketLabel(countryCode: string | null | undefined): string | null {
  const config = getMarketConfig(countryCode)
  return config ? config.label : null
}

    return NextResponse.json({
      ...publicProfile,
      ...commercial,
      visibility: decision.visibility,
      // Job-specific reference only; granted by an active transaction.
      ...(decision.visibility === 'TRANSACTION' ? { activeJobId: evidence.activeJobId } : {}),
    })
  } catch (error) {
    secureConsole.error('Find tasker profile error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
