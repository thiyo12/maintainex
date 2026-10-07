import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { findCandidates } from '@/lib/matching'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the job owner can view matches' }, { status: 403 })

    const result = await findCandidates(prisma, {
      jobId: job.id,
      userId: user.id,
      jobMode: job.budgetType === 'REQUEST_QUOTES' ? 'QUOTE' : 'BOOK_NOW',
      urgency: (job.urgency?.toUpperCase() || 'NORMAL') as 'NORMAL' | 'URGENT' | 'EMERGENCY',
      categoryId: job.categoryId,
      serviceTemplateId: job.serviceTemplateId || undefined,
      latitude: job.latitude,
      longitude: job.longitude,
      countryCode: job.countryCode || 'GLOBAL',
      preferredDate: job.preferredDate,
    })

    const individualUserIds = result.candidates
      .filter((candidate) => candidate.providerType === 'INDIVIDUAL')
      .map((candidate) => candidate.userId || candidate.providerId)
    const companyIds = result.candidates
      .filter((candidate) => candidate.providerType === 'COMPANY')
      .map((candidate) => candidate.companyId || candidate.providerId)

    const [taskers, companies] = await Promise.all([
      prisma.taskerProfile.findMany({
        where: { userId: { in: individualUserIds } },
        include: { user: { select: { name: true } } },
      }),
      prisma.companyProfile.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, companyName: true, rating: true, completedProjects: true, logo: true, description: true },
      }),
    ])

    const taskerIdentities = taskers.length
      ? await prisma.providerIdentity.findMany({
          where: {
            identityType: 'TASKER',
            subjectId: { in: taskers.map(profile => profile.id) },
          },
          select: {
            subjectId: true,
            kycStatus: true,
            verifiedPhotoUrl: true,
          },
        })
      : []

    const taskerByUser = new Map(taskers.map((profile) => [profile.userId, profile]))
    const taskerIdentityByProfile = new Map(
      taskerIdentities.map(identity => [identity.subjectId, identity])
    )
    const companyById = new Map(companies.map((company) => [company.id, company]))

    return NextResponse.json({
      providers: result.candidates.map((candidate) => {
        if (candidate.providerType === 'COMPANY') {
          const company = companyById.get(candidate.companyId || candidate.providerId)
          return {
            id: candidate.providerId,
            name: company?.companyName || '',
            rating: company?.rating || 0,
            completedJobs: company?.completedProjects || 0,
            profileImage: company?.logo || '',
            bio: company?.description || '',
            distanceKm: null,
            score: candidate.score,
            providerType: candidate.providerType,
            components: candidate.components,
            reasons: candidate.reasons,
          }
        }

        const userId = candidate.userId || candidate.providerId
        const profile = taskerByUser.get(userId)
        const identity = profile ? taskerIdentityByProfile.get(profile.id) : null
        const identityVerified =
          profile?.isVerified === true &&
          profile?.verificationStatus === 'VERIFIED' &&
          identity?.kycStatus === 'VERIFIED'
        return {
          id: userId,
          taskerProfileId: profile?.id || candidate.providerId,
          name: profile?.user.name || '',
          rating: profile?.rating || 0,
          completedJobs: profile?.completedJobs || 0,
          profileImage: identityVerified ? identity?.verifiedPhotoUrl || '' : '',
          profilePhotoVerified: identityVerified && Boolean(identity?.verifiedPhotoUrl),
          identityVerified,
          bio: profile?.bio || '',
          distanceKm: null,
          score: candidate.score,
          isVerified: profile?.isVerified || false,
          isOnline: profile?.isOnline || false,
          providerType: candidate.providerType,
          components: candidate.components,
          reasons: candidate.reasons,
        }
      }),
      excluded: result.excluded,
      scoreVersion: result.scoreVersion,
    })
  } catch (error) {
    secureConsole.error('Match error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
