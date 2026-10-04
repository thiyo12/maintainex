import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'

async function serializeTasker(tasker: any) {
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

  return {
    id: tasker.id,
    userId: tasker.userId,
    bio: tasker.bio,
    hourlyRate: tasker.hourlyRate,
    skills: safeParseJsonArr(tasker.skills),
    serviceAreas: safeParseJsonArr(tasker.serviceAreas),
    rating: tasker.rating,
    completedJobs: tasker.completedJobs,
    isVerified: tasker.isVerified,
    identityVerified,
    isOnline: tasker.isOnline,
    completionRate: tasker.completionRate,
    avgResponseMin: tasker.avgResponseMin,
    profileImage: identityVerified ? identity?.verifiedPhotoUrl || null : null,
    profilePhotoVerified: identityVerified && Boolean(identity?.verifiedPhotoUrl),
    user: tasker.user,
    reviews: tasker.reviews.map((review: any) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      reviewerName: review.reviewer.name,
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
      user: { select: { id: true, name: true, nickname: true } },
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

    return NextResponse.json(await serializeTasker(tasker))
  } catch (error) {
    secureConsole.error('Tasker get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
