import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { jsonArrayContains, safeParseJsonArr } from '@/lib/db-utils'

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

    const where: any = { isVerified: true }
    if (isOnline === 'true') where.isOnline = true

    let taskers = await prisma.taskerProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
    })

    if (category) {
      taskers = taskers.filter(t => jsonArrayContains(t.skills, category))
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
        serviceAreas: safeParseJsonArr(t.serviceAreas),
        rating: t.rating,
        completedJobs: t.completedJobs,
        isVerified: t.isVerified,
        isOnline: t.isOnline,
        latitude: t.latitude,
        longitude: t.longitude,
        locationUpdatedAt: t.locationUpdatedAt?.toISOString(),
        user: t.user,
      }))
    )
  } catch (error) {
    console.error('Taskers list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
