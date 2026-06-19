import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { jsonArrayContains, safeParseJsonArr } from '@/lib/db-utils'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const lat = searchParams.get('latitude')
    const lng = searchParams.get('longitude')
    const maxDist = searchParams.get('maxDistance')

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const templateJob = await prisma.templateJob.findUnique({
      where: { id: jobId },
      include: { category: { select: { name: true } } },
    })

    if (!templateJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    let taskers = await prisma.taskerProfile.findMany({
      where: {
        isVerified: true,
        isOnline: true,
      },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
    })

    taskers = taskers.filter(t => jsonArrayContains(t.skills, templateJob.category.name))

    const results = taskers.map(t => {
      let distance: number | undefined
      if (lat && lng && t.latitude && t.longitude) {
        const dlat = (t.latitude - parseFloat(lat)) * Math.PI / 180
        const dlng = (t.longitude - parseFloat(lng)) * Math.PI / 180
        const a = Math.sin(dlat / 2) ** 2 + Math.cos(parseFloat(lat) * Math.PI / 180) * Math.cos(t.latitude * Math.PI / 180) * Math.sin(dlng / 2) ** 2
        distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      }
      return {
        id: t.id,
        userId: t.userId,
        name: t.user.name,
        bio: t.bio || '',
        rating: t.rating,
        completedJobs: t.completedJobs,
        isVerified: t.isVerified,
        isOnline: t.isOnline,
        profileImage: t.profileImage,
        latitude: t.latitude,
        longitude: t.longitude,
        distance,
        skills: safeParseJsonArr(t.skills),
        hourlyRate: t.hourlyRate,
        fixedRate: 0,
        experienceYears: 0,
      }
    })

    const filtered = maxDist && lat && lng
      ? results.filter(r => r.distance !== undefined && r.distance <= parseFloat(maxDist))
      : results

    filtered.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Find tasker error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
