import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { matchTaskerCandidates, resolveJobCategoryKeys } from '@/lib/job-matching'
import { getSetting } from '@/lib/settings'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const latParam = searchParams.get('latitude')
    const lngParam = searchParams.get('longitude')
    const maxDistParam = searchParams.get('maxDistance')

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const templateJob = await prisma.templateJob.findUnique({
      where: { id: jobId },
      include: { category: { select: { id: true } } },
    })

    if (!templateJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const { keys } = await resolveJobCategoryKeys(templateJob.category.id)

    const lat = latParam ? parseFloat(latParam) : null
    const lng = lngParam ? parseFloat(lngParam) : null
    const radiusKm = maxDistParam ? parseFloat(maxDistParam) : await getSetting('matching.radius_km', 50)

    const candidates = await matchTaskerCandidates({ matchKeys: keys, lat, lng, radiusKm })

    return NextResponse.json(
      candidates.map((c) => ({
        id: c.profile.id,
        userId: c.profile.userId,
        name: c.profile.user.name,
        bio: c.profile.bio || '',
        rating: c.profile.rating,
        completedJobs: c.profile.completedJobs,
        isVerified: c.profile.isVerified,
        isOnline: c.profile.isOnline,
        profileImage: c.profile.profileImage,
        latitude: c.profile.latitude,
        longitude: c.profile.longitude,
        distance: c.distanceKm,
        score: Math.round(c.score * 100),
        skills: c.skills,
        hourlyRate: c.profile.hourlyRate,
        fixedRate: 0,
        experienceYears: 0,
      }))
    )
  } catch (error) {
    console.error('Find tasker error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}