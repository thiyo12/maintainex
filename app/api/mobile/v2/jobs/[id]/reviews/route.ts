import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { recalculateReputation } from '@/lib/reputation-engine'
import { resolveProviderActor } from '@/lib/domain/job-lifecycle'

function validScore(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { reviewType, quality, communication, timeliness, cooperation, overallExperience, comment } = body

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Can only review completed jobs' }, { status: 400 })
    }

    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: job.id, status: 'ACCEPTED' },
      select: { providerId: true, providerType: true },
    })
    if (!quote) return NextResponse.json({ error: 'No accepted quote found' }, { status: 400 })

    if (reviewType === 'CUSTOMER_REVIEWS_PROVIDER') {
      if (job.customerId !== user.id) {
        return NextResponse.json({ error: 'Only the customer can review the provider' }, { status: 403 })
      }
      if (![quality, communication, timeliness].every(validScore)) {
        return NextResponse.json({ error: 'quality, communication, timeliness must each be 1-5' }, { status: 400 })
      }

      const existing = await prisma.jobReview.findUnique({
        where: { jobId_customerId: { jobId: job.id, customerId: user.id } },
      })
      if (existing) return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })

      const review = await prisma.jobReview.create({
        data: {
          jobId: job.id,
          customerId: user.id,
          providerId: quote.providerId,
          quality,
          communication,
          timeliness,
          comment: typeof comment === 'string' ? comment.slice(0, 2000) : null,
        },
      })

      const allReviews = await prisma.jobReview.findMany({
        where: { providerId: quote.providerId },
      })
      const avgRating = allReviews.reduce(
        (sum, row) => sum + (row.quality + row.communication + row.timeliness) / 3,
        0,
      ) / allReviews.length
      const completedCount = allReviews.length

      if (quote.providerType === 'INDIVIDUAL') {
        await prisma.taskerProfile.updateMany({
          where: { userId: quote.providerId },
          data: { rating: Math.round(avgRating * 10) / 10, completedJobs: completedCount },
        })
        recalculateReputation(quote.providerId).catch(err =>
          console.error('Reputation recalc error:', err)
        )
      } else {
        await prisma.companyProfile.updateMany({
          where: { id: quote.providerId },
          data: { rating: Math.round(avgRating * 10) / 10, completedProjects: completedCount },
        })
      }

      return NextResponse.json({ review }, { status: 201 })
    }

    if (reviewType === 'PROVIDER_REVIEWS_CUSTOMER') {
      const providerActor = await resolveProviderActor(job.id, user.id)
      if (!providerActor) {
        return NextResponse.json({ error: 'Only the assigned provider can review' }, { status: 403 })
      }
      if (![cooperation, communication, overallExperience].every(validScore)) {
        return NextResponse.json({ error: 'cooperation, communication, overallExperience must each be 1-5' }, { status: 400 })
      }

      const reviewProviderId = quote.providerId
      const existing = await prisma.providerReview.findUnique({
        where: { jobId_providerId: { jobId: job.id, providerId: reviewProviderId } },
      })
      if (existing) return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })

      const review = await prisma.providerReview.create({
        data: {
          jobId: job.id,
          providerId: reviewProviderId,
          customerId: job.customerId,
          cooperation,
          communication,
          overallExperience,
          comment: typeof comment === 'string' ? comment.slice(0, 2000) : null,
        },
      })

      return NextResponse.json({ review }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid reviewType' }, { status: 400 })
  } catch (error) {
    console.error('Create review error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({
      where: { id },
      select: { customerId: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const providerActor = job.customerId === user.id
      ? null
      : await resolveProviderActor(id, user.id)

    if (job.customerId !== user.id && !providerActor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [customerReview, providerReview] = await Promise.all([
      prisma.jobReview.findMany({ where: { jobId: id } }),
      prisma.providerReview.findMany({ where: { jobId: id } }),
    ])

    return NextResponse.json({
      reviews: {
        customerReviews: customerReview,
        providerReviews: providerReview,
      },
    })
  } catch (error) {
    console.error('Get reviews error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
