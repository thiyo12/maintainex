import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { recalculateReputation } from '@/lib/reputation-engine'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

function isValidRating(value: unknown): value is number {
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

    const body = await request.json().catch(() => ({}))
    const reviewType = typeof body?.reviewType === 'string' ? body.reviewType.trim().toUpperCase() : ''
    const { quality, communication, timeliness, cooperation, overallExperience } = body
    const comment = typeof body?.comment === 'string'
      ? body.comment.trim().slice(0, 2000)
      : ''

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
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

      if (![quality, communication, timeliness].every(isValidRating)) {
        return NextResponse.json({ error: 'quality, communication, timeliness must each be integers from 1 to 5' }, { status: 400 })
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
      if (quote.providerType === 'INDIVIDUAL') {
        await prisma.taskerProfile.updateMany({
          where: { userId: quote.providerId },
          data: { rating: Math.round(avgRating * 10) / 10 },
        })
        // Trigger reputation recalculation (fire-and-forget)
        recalculateReputation(quote.providerId).catch(err => secureConsole.error('Reputation recalc error:', err))
      } else {
        await prisma.companyProfile.updateMany({
          where: { id: quote.providerId },
          data: { rating: Math.round(avgRating * 10) / 10 },
        })
      }

      return NextResponse.json({ review }, { status: 201 })
    }

    if (reviewType === 'PROVIDER_REVIEWS_CUSTOMER') {
      const quote = await prisma.jobQuote.findFirst({
        where: { jobId: job.id, status: 'ACCEPTED' },
        select: { providerId: true, providerType: true },
      })
      if (!quote) return NextResponse.json({ error: 'No accepted provider found' }, { status: 400 })

      if (quote.providerType === 'INDIVIDUAL') {
        if (quote.providerId !== user.id) {
          return NextResponse.json({ error: 'Only the assigned provider can review' }, { status: 403 })
        }
      } else {
        const assignment = await prisma.companyJobAssignment.findFirst({
          where: {
            jobId: job.id,
            companyId: quote.providerId,
            workerUserId: user.id,
            status: 'COMPLETED',
          },
          select: { id: true },
        })
        if (!assignment) {
          const { error } = await resolveCompanyContext(user.id, quote.providerId, 'quotes:read')
          if (error) return NextResponse.json({ error: 'Only the accepted company or assigned worker can review' }, { status: 403 })
        }
      }

      const canonicalProviderId = quote.providerId
      const existing = await prisma.providerReview.findUnique({
        where: { jobId_providerId: { jobId: job.id, providerId: canonicalProviderId } },
      })
      if (existing) return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })

      if (![cooperation, communication, overallExperience].every(isValidRating)) {
        return NextResponse.json(
          { error: 'cooperation, communication, overallExperience must each be integers from 1 to 5' },
          { status: 400 }
        )
      }

      const review = await prisma.providerReview.create({
        data: {
          jobId: job.id,
          providerId: canonicalProviderId,
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
  } catch (error: any) {
    secureConsole.error('Create review error:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })
    }
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

    const job = await prisma.marketplaceJob.findUnique({ where: { id }, select: { customerId: true } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    const acceptedQuote = await prisma.jobQuote.findFirst({
      where: { jobId: id, status: 'ACCEPTED' },
      select: { providerId: true, providerType: true },
    })

    let canRead = job.customerId === user.id
    if (!canRead && acceptedQuote?.providerType === 'INDIVIDUAL') {
      canRead = acceptedQuote.providerId === user.id
    } else if (!canRead && acceptedQuote?.providerType === 'COMPANY') {
      const assignment = await prisma.companyJobAssignment.findFirst({
        where: {
          jobId: id,
          companyId: acceptedQuote.providerId,
          workerUserId: user.id,
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
        },
        select: { id: true },
      })
      if (assignment) {
        canRead = true
      } else {
        const companyAccess = await resolveCompanyContext(user.id, acceptedQuote.providerId, 'quotes:read')
        canRead = !companyAccess.error
      }
    }

    if (!canRead) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [customerReview, providerReview] = await Promise.all([
      prisma.jobReview.findMany({ where: { jobId: id } }),
      prisma.providerReview.findMany({ where: { jobId: id } }),
    ])
    return NextResponse.json({ reviews: { customerReviews: customerReview, providerReviews: providerReview } })
  } catch (error) {
    secureConsole.error('Get reviews error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
