import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

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

    const members = await prisma.teamMember.findMany({
      where: { companyId: profile.id },
      orderBy: [{ isOnline: 'desc' }, { rating: 'desc' }],
    })

    return NextResponse.json(
      members.map(m => ({
        id: m.id,
        name: m.name,
        role: m.role,
        skills: m.skills,
        isOnline: m.isOnline,
        rating: m.rating,
        completedJobs: m.completedJobs,
        joinedAt: m.joinedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error('Team list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
