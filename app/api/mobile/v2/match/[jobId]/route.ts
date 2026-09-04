import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { matchTaskerCandidates, resolveJobCategoryKeys } from '@/lib/job-matching'

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the job owner can view matches' }, { status: 403 })

    const { keys } = await resolveJobCategoryKeys(job.categoryId)
    const candidates = await matchTaskerCandidates({
      matchKeys: keys,
      lat: job.latitude,
      lng: job.longitude,
      maxResults: 25,
    })

    return NextResponse.json({
      providers: candidates.map((c) => ({
        id: c.profile.userId,
        taskerProfileId: c.profile.id,
        name: c.profile.user.name,
        rating: c.profile.rating,
        completedJobs: c.profile.completedJobs,
        profileImage: c.profile.profileImage,
        bio: c.profile.bio || '',
        distanceKm: c.distanceKm,
        score: Math.round(c.score * 100),
        isOnline: c.profile.isOnline,
      })),
    })
  } catch (error) {
    console.error('Match error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}