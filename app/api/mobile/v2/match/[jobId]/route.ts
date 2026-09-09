import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { findCandidates } from '@/lib/matching'

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

    const result = await findCandidates(prisma, {
      jobId: job.id,
      userId: user.id,
      jobMode: job.budgetType === 'REQUEST_QUOTES' ? 'QUOTE' : 'BOOK_NOW',
      urgency: 'NORMAL',
      categoryId: job.categoryId,
      serviceTemplateId: job.serviceTemplateId || undefined,
      latitude: job.latitude,
      longitude: job.longitude,
      countryCode: job.countryCode || 'GLOBAL',
    })

    return NextResponse.json({
      providers: result.candidates.map((c) => ({
        id: c.userId || c.providerId,
        taskerProfileId: c.providerId,
        name: '',
        rating: 0,
        completedJobs: 0,
        profileImage: '',
        bio: '',
        distanceKm: 0,
        score: Math.round(c.score * 100),
        isOnline: false,
        providerType: c.providerType,
        components: c.components,
        reasons: c.reasons,
      })),
      excluded: result.excluded,
      scoreVersion: result.scoreVersion,
    })
  } catch (error) {
    console.error('Match error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
