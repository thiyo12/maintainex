import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { getLocationName } from '@/lib/locations'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: params.id },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const customer = await prisma.user.findUnique({
      where: { id: job.customerId },
      select: { id: true, name: true, phone: true, email: true },
    })

    const quotes = await prisma.jobQuote.findMany({
      where: { jobId: job.id },
      orderBy: { createdAt: 'desc' },
    })

    const escrow = await prisma.jobEscrow.findFirst({
      where: { jobId: job.id },
    })

    const workspace = await prisma.jobWorkspace.findUnique({
      where: { jobId: job.id },
    })

    const reviews = await prisma.jobReview.findMany({
      where: { jobId: job.id },
    })

    const locationName = job.areaId ? getLocationName(job.areaId) : null

    const enrichedQuotes = await Promise.all(
      quotes.map(async (quote) => {
        const provider = await prisma.user.findUnique({
          where: { id: quote.providerId },
          select: { id: true, name: true, phone: true, email: true },
        })

        let providerRating = 0
        let completedJobs = 0

        if (quote.providerType === 'INDIVIDUAL') {
          const profile = await prisma.taskerProfile.findUnique({
            where: { userId: quote.providerId },
            select: { rating: true, completedJobs: true },
          })
          if (profile) {
            providerRating = profile.rating
            completedJobs = profile.completedJobs
          }
        } else {
          const profile = await prisma.companyProfile.findUnique({
            where: { userId: quote.providerId },
            select: { rating: true, completedProjects: true },
          })
          if (profile) {
            providerRating = profile.rating
            completedJobs = profile.completedProjects
          }
        }

        return {
          ...quote,
          provider: provider || { id: quote.providerId, name: 'Unknown', phone: null, email: null },
          providerRating,
          completedJobs,
        }
      })
    )

    return NextResponse.json({
      job: {
        ...job,
        customer: customer || null,
        locationName,
        quotes: enrichedQuotes,
        escrow: escrow || null,
        workspace: workspace || null,
        reviews,
      },
    })
  } catch (error) {
    console.error('Get job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
