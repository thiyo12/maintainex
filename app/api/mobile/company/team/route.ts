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
        orderBy: [{ isOnline: 'desc' }, { rating: 'desc' }],
      }),
      prisma.teamInvite.findMany({
        where: { companyId: context!.companyId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      members: members.map(m => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        role: m.role,
        skills: safeParseJsonArr(m.skills),
        isOnline: m.isOnline,
        rating: m.rating,
        completedJobs: m.completedJobs,
        joinedAt: m.joinedAt.toISOString(),
      })),
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
    console.error('Team list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
