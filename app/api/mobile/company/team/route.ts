import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { safeParseJsonArr } from '@/lib/db-utils'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'members:read')
    if (error) return error

    const [members, invites] = await Promise.all([
      prisma.teamMember.findMany({
        where: { companyId: context!.companyId },
        include: {
          user: {
            select: {
              identityStatus: true,
            },
          },
        },
        orderBy: [{ isOnline: 'desc' }, { rating: 'desc' }],
      }),
      prisma.teamInvite.findMany({
        where: { companyId: context!.companyId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const memberUserIds = members
      .map(member => member.userId)
      .filter((value): value is string => Boolean(value))
    const personIdentities = memberUserIds.length
      ? await prisma.providerIdentity.findMany({
          where: {
            currentUserId: { in: memberUserIds },
            identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
            kycStatus: 'VERIFIED',
            verifiedPhotoUrl: { not: null },
          },
          orderBy: { updatedAt: 'desc' },
          select: {
            currentUserId: true,
            verifiedPhotoUrl: true,
            kycStatus: true,
          },
        })
      : []

    const identityByUser = new Map<string, (typeof personIdentities)[number]>()
    for (const identity of personIdentities) {
      if (identity.currentUserId && !identityByUser.has(identity.currentUserId)) {
        identityByUser.set(identity.currentUserId, identity)
      }
    }

    return NextResponse.json({
      members: members.map(m => {
        const identity = m.userId ? identityByUser.get(m.userId) : null
        const identityVerified =
          m.user?.identityStatus === 'VERIFIED' &&
          identity?.kycStatus === 'VERIFIED' &&
          Boolean(identity?.verifiedPhotoUrl)

        return {
        id: m.id,
        userId: m.userId,
        name: m.name,
        role: m.role,
        skills: safeParseJsonArr(m.skills),
        isOnline: m.isOnline,
        rating: m.rating,
          completedJobs: m.completedJobs,
          identityVerified,
          profilePhotoVerified: identityVerified,
          verifiedPhotoUrl: identityVerified ? identity?.verifiedPhotoUrl || null : null,
          joinedAt: m.joinedAt.toISOString(),
        }
      }),
      pendingInvites: invites.map(i => ({
        id: i.id,
        name: i.name,
        email: i.email,
        phone: i.phone,
        role: i.role,
        createdAt: i.createdAt.toISOString(),
        expiresAt: i.expiresAt.toISOString(),
      })),
    })
  } catch (error) {
    secureConsole.error('Team list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
