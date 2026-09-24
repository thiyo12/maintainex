import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { getLocationName } from '@/lib/locations'

function redactSensitive(data: Record<string, any>, allowContact: boolean): Record<string, any> {
  if (allowContact) return data
  return { ...data, phone: null, email: null }
}

async function getCompanyIdsForUser(userId: string): Promise<string[]> {
  const [owned, memberships] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.teamMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { companyId: true },
    }),
  ])
  return [...new Set([
    ...(owned ? [owned.id] : []),
    ...memberships.map(member => member.companyId),
  ])]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isOwner = job.customerId === user.id
    const companyIds = isOwner ? [] : await getCompanyIdsForUser(user.id)
    let isQuoter = isOwner
    if (!isOwner) {
      const userQuote = await prisma.jobQuote.findFirst({
        where: {
          jobId: job.id,
          OR: [
            { providerType: 'INDIVIDUAL', providerId: user.id },
            ...(companyIds.length > 0 ? [{ providerType: 'COMPANY', providerId: { in: companyIds } }] : []),
            { actorUserId: user.id },
          ],
        },
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

    const quotes = isOwner
      ? await prisma.jobQuote.findMany({ where: { jobId: job.id }, orderBy: { price: 'asc' } })
      : isQuoter
        ? await prisma.jobQuote.findMany({
            where: {
              jobId: job.id,
              OR: [
                { providerType: 'INDIVIDUAL', providerId: user.id },
                ...(companyIds.length > 0 ? [{ providerType: 'COMPANY', providerId: { in: companyIds } }] : []),
                { actorUserId: user.id },
              ],
            },
            orderBy: { price: 'asc' },
          })
        : []

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })

    const acceptedQuote = quotes.find((q) => q.status === 'ACCEPTED')
    let acceptedProvider = null
    if (acceptedQuote?.providerType === 'INDIVIDUAL') {
      const providerUser = await prisma.user.findUnique({
        where: { id: acceptedQuote.providerId },
        select: { id: true, name: true, phone: true },
      })
      const providerProfile = await prisma.taskerProfile.findUnique({
        where: { userId: acceptedQuote.providerId },
        select: { latitude: true, longitude: true, rating: true },
      })
      if (providerUser) acceptedProvider = { ...providerUser, ...providerProfile, chatUserId: providerUser.id }
    } else if (acceptedQuote?.providerType === 'COMPANY') {
      const company = await prisma.companyProfile.findUnique({
        where: { id: acceptedQuote.providerId },
        select: {
          id: true,
          userId: true,
          companyName: true,
          logo: true,
          rating: true,
          latitude: true,
          longitude: true,
          user: { select: { phone: true } },
        },
      })
      if (company) {
        acceptedProvider = {
          id: company.id,
          name: company.companyName,
          phone: company.user.phone,
          profileImage: company.logo,
          rating: company.rating,
          latitude: company.latitude,
          longitude: company.longitude,
          chatUserId: acceptedQuote.actorUserId || company.userId,
          providerType: 'COMPANY',
        }
      }
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
        let provider: Record<string, any> | null = null
        let providerRating = 0
        let completedJobs = 0
        let isQuoteOwner = false

        if (q.providerType === 'INDIVIDUAL') {
          const providerUser = await prisma.user.findUnique({
            where: { id: q.providerId },
            select: { id: true, name: true, phone: true, email: true },
          })
          const profile = await prisma.taskerProfile.findUnique({
            where: { userId: q.providerId },
            select: { rating: true, completedJobs: true, profileImage: true, isOnline: true, isVerified: true },
          })
          providerRating = profile?.rating || 0
          completedJobs = profile?.completedJobs || 0
          isQuoteOwner = q.providerId === user.id
          if (providerUser) {
            provider = {
              ...redactSensitive(providerUser, isQuoteOwner),
              chatUserId: providerUser.id,
              profileImage: profile?.profileImage || null,
              avatar: profile?.profileImage || null,
              isOnline: profile?.isOnline || false,
              isVerified: profile?.isVerified || false,
              rating: providerRating,
              completedJobs,
            }
          }
        } else {
          const company = await prisma.companyProfile.findUnique({
            where: { id: q.providerId },
            select: {
              id: true,
              userId: true,
              companyName: true,
              logo: true,
              rating: true,
              completedProjects: true,
              isVerified: true,
              user: { select: { phone: true, email: true } },
            },
          })
          if (company) {
            providerRating = company.rating || 0
            completedJobs = company.completedProjects || 0
            isQuoteOwner = companyIds.includes(company.id) || q.actorUserId === user.id
            provider = {
              id: company.id,
              name: company.companyName,
              chatUserId: q.actorUserId || company.userId,
              profileImage: company.logo,
              avatar: company.logo,
              isVerified: company.isVerified,
              isOnline: false,
              rating: providerRating,
              completedJobs,
              ...redactSensitive({ phone: company.user.phone, email: company.user.email }, isQuoteOwner),
            }
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
    let isAssignedProvider = false
    if (!isOwner) {
      const acceptedQuote = await prisma.jobQuote.findFirst({
        where: { jobId: job.id, providerId: user.id, status: 'ACCEPTED' },
      })
      isAssignedProvider = !!acceptedQuote
    }

    if (!isOwner && !isAssignedProvider) {
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
      if (key in body) {
        data[key] = body[key]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    if (data.preferredDate) {
      data.preferredDate = new Date(data.preferredDate)
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
