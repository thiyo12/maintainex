import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { reviewType, quality, communication, timeliness, cooperation, overallExperience, comment } = body

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status !== 'COMPLETED') return NextResponse.json({ error: 'Can only review completed jobs' }, { status: 400 })

    if (reviewType === 'CUSTOMER_REVIEWS_PROVIDER') {
      if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can review the provider' }, { status: 403 })

      const quote = await prisma.jobQuote.findFirst({ where: { jobId: job.id, status: 'ACCEPTED' } })
      if (!quote) return NextResponse.json({ error: 'No accepted quote found' }, { status: 400 })

      const existing = await prisma.jobReview.findUnique({
        where: { jobId_customerId: { jobId: job.id, customerId: user.id } },
      })
      if (existing) return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })

      if (!quality || !communication || !timeliness) {
        return NextResponse.json({ error: 'quality, communication, timeliness (1-5) required' }, { status: 400 })
      }

      const review = await prisma.jobReview.create({
        data: {
          jobId: job.id,
          customerId: user.id,
          providerId: quote.providerId,
          quality,
          communication,
          timeliness,
          comment: comment || null,
        },
      })

      const allReviews = await prisma.jobReview.findMany({
        where: { providerId: quote.providerId },
      })
      const avgRating = allReviews.reduce((sum, r) => sum + (r.quality + r.communication + r.timeliness) / 3, 0) / allReviews.length
      const completedCount = await prisma.jobReview.count({
        where: { providerId: quote.providerId },
      })

      if (quote.providerType === 'INDIVIDUAL') {
        await prisma.taskerProfile.updateMany({
          where: { userId: quote.providerId },
          data: { rating: Math.round(avgRating * 10) / 10, completedJobs: completedCount },
        })
      } else {
        await prisma.companyProfile.updateMany({
          where: { userId: quote.providerId },
          data: { rating: Math.round(avgRating * 10) / 10, completedProjects: completedCount },
        })
      }

      return NextResponse.json({ review }, { status: 201 })
    }

    if (reviewType === 'PROVIDER_REVIEWS_CUSTOMER') {
      const quote = await prisma.jobQuote.findFirst({
        where: { jobId: job.id, providerId: user.id, status: 'ACCEPTED' },
      })
      if (!quote) return NextResponse.json({ error: 'Only the assigned provider can review' }, { status: 403 })

      const existing = await prisma.providerReview.findUnique({
        where: { jobId_providerId: { jobId: job.id, providerId: user.id } },
      })
      if (existing) return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })

      if (!cooperation || !communication || !overallExperience) {
        return NextResponse.json({ error: 'cooperation, communication, overallExperience (1-5) required' }, { status: 400 })
      }

      const review = await prisma.providerReview.create({
        data: {
          jobId: job.id,
          providerId: user.id,
          customerId: job.customerId,
          cooperation,
          communication,
          overallExperience,
          comment: comment || null,
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
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [customerReview, providerReview] = await Promise.all([
      prisma.jobReview.findMany({ where: { jobId: params.id } }),
      prisma.providerReview.findMany({ where: { jobId: params.id } }),
    ])
    return NextResponse.json({ reviews: { customerReviews: customerReview, providerReviews: providerReview } })
  } catch (error) {
    console.error('Get reviews error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
