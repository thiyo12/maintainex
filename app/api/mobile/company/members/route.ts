import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { getCompanyMembers } from '@/lib/phase6/company-ownership'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const members = await getCompanyMembers(profile.id)

    return NextResponse.json({
      members: members.map(m => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        role: m.role,
        status: m.status,
        isOnline: m.isOnline,
        rating: m.rating,
        completedJobs: m.completedJobs,
        joinedAt: m.joinedAt.toISOString(),
        user: m.user ? {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
          identityStatus: m.user.identityStatus,
          isSuspended: m.user.isSuspended,
          isBanned: m.user.isBanned,
        } : null,
      })),
    })
  } catch (error) {
    console.error('Get company members error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
