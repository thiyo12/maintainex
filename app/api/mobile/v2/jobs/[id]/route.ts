import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { getLocationName } from '@/lib/locations'
import { resolveQuoteVisibility } from '@/lib/phase6/quote-visibility'
import { resolveProviderActor } from '@/lib/domain/job-lifecycle'

function redactCustomer(data: Record<string, any>, isOwner: boolean): Record<string, any> {
  if (isOwner) return data
  return { ...data, phone: null, email: null }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const visibility = await resolveQuoteVisibility(prisma, {
      userId: user.id,
      jobId: job.id,
    })
    const isOwner = visibility.isCustomer
    const isQuoter = isOwner || visibility.allowedQuoteIds.length > 0

    if (!isOwner && job.status !== 'OPEN' && !isQuoter) {
      const providerActor = await resolveProviderActor(job.id, user.id)
      if (!providerActor) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const customer = await prisma.user.findUnique({
      where: { id: job.customerId },
      select: { id: true, name: true, phone: true, email: true },
    })

    const quotes = isOwner
      ? await prisma.jobQuote.findMany({ where: { jobId: job.id, status: { not: 'SUPERSEDED' } }, orderBy: { price: 'asc' } })
      : visibility.allowedQuoteIds.length > 0
        ? await prisma.jobQuote.findMany({
            where: { id: { in: visibility.allowedQuoteIds }, status: { not: 'SUPERSEDED' } },
            orderBy: { price: 'asc' },
          })
        : []

    const [escrow, workspace] = await Promise.all([
      prisma.jobEscrow.findFirst({ where: { jobId: job.id } }),
      prisma.jobWorkspace.findUnique({ where: { jobId: job.id } }),
    ])

    const acceptedQuote = isOwner
      ? await prisma.jobQuote.findFirst({ where: { jobId: job.id, status: 'ACCEPTED' } })
      : quotes.find(q => q.status === 'ACCEPTED') || null

    let acceptedProvider: any = null
    if (acceptedQuote?.providerType === 'INDIVIDUAL') {
      const [providerUser, providerProfile] = await Promise.all([
        prisma.user.findUnique({
          where: { id: acceptedQuote.providerId },
          select: { id: true, name: true },
        }),
        prisma.taskerProfile.findUnique({
          where: { userId: acceptedQuote.providerId },
          select: { latitude: true, longitude: true, rating: true },
        }),
      ])
      if (providerUser) {
        acceptedProvider = {
          ...providerUser,
          chatUserId: providerUser.id,
          ...providerProfile,
        }
      }
    } else if (acceptedQuote?.providerType === 'COMPANY') {
      const company = await prisma.companyProfile.findUnique({
        where: { id: acceptedQuote.providerId },
        select: { id: true, userId: true, companyName: true, rating: true, logo: true },
      })
      if (company) {
        acceptedProvider = {
          id: company.id,
          name: company.companyName,
          chatUserId: company.userId,
          rating: company.rating,
          profileImage: company.logo,
        }
      }
    }

    const [customerReviews, providerReviews] = await Promise.all([
      prisma.jobReview.findMany({ where: { jobId: job.id } }),
      prisma.providerReview.findMany({ where: { jobId: job.id } }),
    ])

    const locationName = job.areaId ? getLocationName(job.areaId) : null

    const [jobCategory, templateJob, serviceTemplate] = await Promise.all([
      job.categoryId
        ? prisma.jobCategory.findUnique({ where: { id: job.categoryId }, select: { name: true } })
        : null,
      job.templateJobId
        ? prisma.templateJob.findUnique({ where: { id: job.templateJobId }, select: { name: true } })
        : null,
      job.serviceTemplateId
        ? prisma.serviceTemplate.findUnique({ where: { id: job.serviceTemplateId }, select: { name: true } })
        : null,
    ])

    const enrichedQuotes = await Promise.all(
      quotes.map(async q => {
        let provider: any = null
        let providerRating = 0
        let completedJobs = 0

        if (q.providerType === 'INDIVIDUAL') {
          const [providerUser, profile] = await Promise.all([
            prisma.user.findUnique({
              where: { id: q.providerId },
              select: { id: true, name: true },
            }),
            prisma.taskerProfile.findUnique({
              where: { userId: q.providerId },
              select: { rating: true, completedJobs: true, profileImage: true, isOnline: true, isVerified: true },
            }),
          ])
          if (providerUser) {
            provider = {
              id: providerUser.id,
              name: providerUser.name,
              chatUserId: providerUser.id,
              profileImage: profile?.profileImage || null,
              isOnline: profile?.isOnline || false,
              isVerified: profile?.isVerified || false,
            }
          }
          if (profile) {
            providerRating = profile.rating
            completedJobs = profile.completedJobs
          }
        } else {
          const profile = await prisma.companyProfile.findUnique({
            where: { id: q.providerId },
            select: {
              id: true,
              userId: true,
              companyName: true,
              logo: true,
              rating: true,
              completedProjects: true,
              isVerified: true,
            },
          })
          if (profile) {
            provider = {
              id: profile.id,
              name: profile.companyName,
              chatUserId: profile.userId,
              profileImage: profile.logo,
              isVerified: profile.isVerified,
            }
            providerRating = profile.rating
            completedJobs = profile.completedProjects
          }
        }

        return {
          ...q,
          price: Number(q.price),
          provider,
          providerRating,
          completedJobs,
        }
      })
    )

    return NextResponse.json({
      job: {
        ...job,
        budgetAmount: job.budgetAmount != null ? Number(job.budgetAmount) : null,
        aiEstimate: job.aiEstimateJson ? JSON.parse(job.aiEstimateJson) : null,
        smartBooking: job.smartBookingJson ? JSON.parse(job.smartBookingJson) : null,
        notifiedCount: job.notifiedCount,
        categoryName: jobCategory?.name || null,
        templateJobName: templateJob?.name || null,
        serviceTemplateName: serviceTemplate?.name || null,
        customer: customer ? redactCustomer(customer, isOwner) : null,
        locationName,
        quotes: enrichedQuotes,
        escrow: escrow
          ? {
              ...escrow,
              amount: Number(escrow.amount),
              serviceFee: Number(escrow.serviceFee),
              totalAmount: Number(escrow.totalAmount),
            }
          : null,
        workspace: workspace || null,
        reviews: { customerReviews, providerReviews },
        acceptedQuote: acceptedQuote
          ? {
              ...acceptedQuote,
              price: Number(acceptedQuote.price),
              provider: acceptedProvider,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Get job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

const UPDATABLE_FIELDS = [
  'title',
  'description',
  'preferredDate',
  'preferredTimeSlot',
  'urgency',
  'estimatedDuration',
  'workersCount',
  'postalCode',
  'addressStreet',
  'addressBuilding',
  'addressApartment',
  'addressLandmark',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isOwner = job.customerId === user.id
    const providerActor = isOwner ? null : await resolveProviderActor(job.id, user.id)

    if (!isOwner && !providerActor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!['OPEN', 'QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)) {
      return NextResponse.json(
        { error: 'Job cannot be updated in its current status' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const data: Record<string, any> = {}

    for (const key of UPDATABLE_FIELDS) {
      if (key in body) data[key] = body[key]
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    if (data.preferredDate) {
      data.preferredDate = new Date(data.preferredDate)
      if (Number.isNaN(data.preferredDate.getTime())) {
        return NextResponse.json({ error: 'Invalid preferredDate' }, { status: 400 })
      }
    }

    const updated = await prisma.marketplaceJob.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      job: {
        ...updated,
        budgetAmount: updated.budgetAmount != null ? Number(updated.budgetAmount) : null,
      },
    })
  } catch (error) {
    console.error('PATCH job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
