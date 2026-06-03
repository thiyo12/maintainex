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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const customer = await prisma.user.findUnique({
      where: { id: job.customerId },
      select: { id: true, name: true, phone: true, email: true },
    })

    const quotes = await prisma.jobQuote.findMany({
      where: { jobId: job.id },
      orderBy: { price: 'asc' },
    })

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })

    const [customerReviews, providerReviews] = await Promise.all([
      prisma.jobReview.findMany({ where: { jobId: job.id } }),
      prisma.providerReview.findMany({ where: { jobId: job.id } }),
    ])

    const locationName = job.areaId ? getLocationName(job.areaId) : null

    const enrichedQuotes = await Promise.all(
      quotes.map(async (q) => {
        const provider = await prisma.user.findUnique({
          where: { id: q.providerId },
          select: { id: true, name: true, phone: true, email: true },
        })
        let providerRating = 0, completedJobs = 0
        if (q.providerType === 'INDIVIDUAL') {
          const p = await prisma.taskerProfile.findUnique({
            where: { userId: q.providerId },
            select: { rating: true, completedJobs: true },
          })
          if (p) { providerRating = p.rating; completedJobs = p.completedJobs }
        } else {
          const p = await prisma.companyProfile.findUnique({
            where: { userId: q.providerId },
            select: { rating: true, completedProjects: true },
          })
          if (p) { providerRating = p.rating; completedJobs = p.completedProjects }
        }
        return { ...q, provider, providerRating, completedJobs }
      })
    )

    return NextResponse.json({
      job: { ...job, customer, locationName, quotes: enrichedQuotes, escrow: escrow || null, workspace: workspace || null, reviews: { customerReviews, providerReviews } },
    })
  } catch (error) {
    console.error('Get job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
