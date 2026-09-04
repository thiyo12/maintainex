import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { getLocationName } from '@/lib/locations'

function redactSensitive(data: Record<string, any>, _isOwner: boolean): Record<string, any> {
  if (_isOwner) return data
  return { ...data, phone: null, email: null }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isOwner = job.customerId === user.id
    let isQuoter = isOwner
    if (!isOwner) {
      const userQuote = await prisma.jobQuote.findFirst({
        where: { jobId: job.id, providerId: user.id },
      })
      isQuoter = !!userQuote
      if (job.status !== 'OPEN' && !isQuoter) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const customer = await prisma.user.findUnique({
      where: { id: job.customerId },
      select: { id: true, name: true, phone: true, email: true },
    })

    const quotes = isOwner || isQuoter
      ? await prisma.jobQuote.findMany({ where: { jobId: job.id }, orderBy: { price: 'asc' } })
      : []

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })

    const acceptedQuote = quotes.find((q) => q.status === 'ACCEPTED')
    let acceptedProvider = null
    if (acceptedQuote) {
      const providerUser = await prisma.user.findUnique({
        where: { id: acceptedQuote.providerId },
        select: { id: true, name: true, phone: true },
      })
      const providerProfile = await prisma.taskerProfile.findUnique({
        where: { userId: acceptedQuote.providerId },
        select: { latitude: true, longitude: true, rating: true },
      })
      if (providerUser) acceptedProvider = { ...providerUser, ...providerProfile }
    }

    const [customerReviews, providerReviews] = await Promise.all([
      prisma.jobReview.findMany({ where: { jobId: job.id } }),
      prisma.providerReview.findMany({ where: { jobId: job.id } }),
    ])

    const locationName = job.areaId ? getLocationName(job.areaId) : null

    const [jobCategory, templateJob, serviceTemplate] = await Promise.all([
      job.categoryId ? prisma.jobCategory.findUnique({ where: { id: job.categoryId }, select: { name: true } }) : null,
      job.templateJobId ? prisma.templateJob.findUnique({ where: { id: job.templateJobId }, select: { name: true } }) : null,
      job.serviceTemplateId ? prisma.serviceTemplate.findUnique({ where: { id: job.serviceTemplateId }, select: { name: true } }) : null,
    ])

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
        const isQuoteOwner = q.providerId === user.id
        return { ...q, price: Number(q.price), provider: provider ? redactSensitive(provider, isQuoteOwner) : null, providerRating, completedJobs }
      })
    )

    return NextResponse.json({
      job: {
        ...job,
        budgetAmount: Number(job.budgetAmount),
        aiEstimate: job.aiEstimateJson ? JSON.parse(job.aiEstimateJson) : null,
        smartBooking: job.smartBookingJson ? JSON.parse(job.smartBookingJson) : null,
        notifiedCount: job.notifiedCount,
        categoryName: jobCategory?.name || null,
        templateJobName: templateJob?.name || null,
        serviceTemplateName: serviceTemplate?.name || null,
        customer: customer ? redactSensitive(customer, isOwner) : null,
        locationName,
        quotes: enrichedQuotes,
        escrow: escrow ? { ...escrow, amount: Number(escrow.amount), serviceFee: Number(escrow.serviceFee), totalAmount: Number(escrow.totalAmount) } : null,
        workspace: workspace || null,
        reviews: { customerReviews, providerReviews },
        acceptedQuote: acceptedQuote ? { ...acceptedQuote, price: Number(acceptedQuote.price), provider: acceptedProvider } : null,
      },
    })
  } catch (error) {
    console.error('Get job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
