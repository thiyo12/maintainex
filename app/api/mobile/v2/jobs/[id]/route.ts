import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { getLocationName } from '@/lib/locations'
import { hasCompanyPermission, type CompanyRole } from '@/lib/phase6/rbac'
import { getCurrencyForCountry, minorUnitsToMajorUnits } from '@/lib/shared/money/money'

function redactSensitive(data: Record<string, any>, _isOwner: boolean): Record<string, any> {
  if (_isOwner) return data
  return { ...data, phone: null, email: null }
}

async function getReadableCompanyIds(userId: string): Promise<string[]> {
  const [ownedCompany, memberships] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.teamMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { companyId: true, role: true },
    }),
  ])

  const ids = memberships
    .filter(member => hasCompanyPermission(member.role as CompanyRole, 'quotes:read'))
    .map(member => member.companyId)

  if (ownedCompany?.id) ids.push(ownedCompany.id)
  return Array.from(new Set(ids))
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
    const currency = getCurrencyForCountry(job.countryCode)

    const isOwner = job.customerId === user.id
    const requestedContext = new URL(_request.url).searchParams.get('context')
    let isQuoter = isOwner
    let providerContextId: string | null = null
    let providerContextType: 'INDIVIDUAL' | 'COMPANY' | null = null
    let readableCompanyIds: string[] = []

    if (!isOwner) {
      if (requestedContext === 'company') {
        readableCompanyIds = await getReadableCompanyIds(user.id)
        let companyQuote = readableCompanyIds.length > 0
          ? await prisma.jobQuote.findFirst({
              where: {
                jobId: job.id,
                providerType: 'COMPANY',
                providerId: { in: readableCompanyIds },
              },
              orderBy: { createdAt: 'desc' },
            })
          : null

        if (!companyQuote) {
          const workerAssignment = await prisma.companyJobAssignment.findFirst({
            where: {
              jobId: job.id,
              workerUserId: user.id,
              status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
            },
            orderBy: { assignedAt: 'desc' },
            select: { companyId: true },
          })
          if (workerAssignment) {
            companyQuote = await prisma.jobQuote.findFirst({
              where: {
                jobId: job.id,
                providerType: 'COMPANY',
                providerId: workerAssignment.companyId,
                status: 'ACCEPTED',
              },
              orderBy: { createdAt: 'desc' },
            })
          }
        }

        if (companyQuote && (job.status === 'OPEN' || companyQuote.status === 'ACCEPTED')) {
          providerContextId = companyQuote.providerId
          providerContextType = 'COMPANY'
        }
      } else {
        const userQuote = await prisma.jobQuote.findFirst({
          where: { jobId: job.id, providerId: user.id, providerType: 'INDIVIDUAL' },
          orderBy: { createdAt: 'desc' },
        })
        if (userQuote && (job.status === 'OPEN' || userQuote.status === 'ACCEPTED')) {
          providerContextId = user.id
          providerContextType = 'INDIVIDUAL'
        } else {
          const workerAssignment = await prisma.companyJobAssignment.findFirst({
            where: {
              jobId: job.id,
              workerUserId: user.id,
              status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
            },
            orderBy: { assignedAt: 'desc' },
            select: { companyId: true },
          })

          if (workerAssignment) {
            const companyQuote = await prisma.jobQuote.findFirst({
              where: {
                jobId: job.id,
                providerId: workerAssignment.companyId,
                providerType: 'COMPANY',
                status: 'ACCEPTED',
              },
              select: { providerId: true },
            })
            if (companyQuote) {
              providerContextId = workerAssignment.companyId
              providerContextType = 'COMPANY'
            }
          }
        }
      }

      isQuoter = providerContextId !== null
      if (job.status !== 'OPEN' && !isQuoter) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const customer = await prisma.user.findUnique({
      where: { id: job.customerId },
      select: { id: true, name: true },
    })

    const quotes = isOwner
      ? await prisma.jobQuote.findMany({ where: { jobId: job.id }, orderBy: { price: 'asc' } })
      : isQuoter && providerContextId && providerContextType
        ? await prisma.jobQuote.findMany({
            where: {
              jobId: job.id,
              providerId: providerContextId,
              providerType: providerContextType,
            },
            orderBy: { createdAt: 'desc' },
          })
        : []

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })

    const acceptedQuote = quotes.find((q) => q.status === 'ACCEPTED')
    let acceptedProvider = null
    if (acceptedQuote) {
      if (acceptedQuote.providerType === 'INDIVIDUAL') {
        const providerUser = await prisma.user.findUnique({
          where: { id: acceptedQuote.providerId },
          select: { id: true, name: true },
        })
        const providerProfile = await prisma.taskerProfile.findUnique({
          where: { userId: acceptedQuote.providerId },
          select: { latitude: true, longitude: true, rating: true },
        })
        if (providerUser) acceptedProvider = { ...providerUser, ...providerProfile }
      } else {
        const company = await prisma.companyProfile.findUnique({
          where: { id: acceptedQuote.providerId },
          select: { id: true, userId: true, companyName: true, logo: true, rating: true, latitude: true, longitude: true },
        })
        if (company) {
          acceptedProvider = {
            id: company.id,
            userId: company.userId,
            name: company.companyName,
            profileImage: company.logo,
            rating: company.rating,
            latitude: company.latitude,
            longitude: company.longitude,
          }
        }
      }
    }

    const [customerReviews, providerReviews, companyAssignment] = await Promise.all([
      prisma.jobReview.findMany({ where: { jobId: job.id } }),
      prisma.providerReview.findMany({ where: { jobId: job.id } }),
      providerContextType === 'COMPANY' && providerContextId
        ? prisma.companyJobAssignment.findFirst({
            where: {
              jobId: job.id,
              companyId: providerContextId,
              status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
            },
            orderBy: { assignedAt: 'desc' },
            select: {
              id: true,
              workerUserId: true,
              status: true,
              assignedAt: true,
              acceptedAt: true,
              startedAt: true,
              completedAt: true,
              worker: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve(null),
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

        if (q.providerType === 'INDIVIDUAL') {
          const [providerUser, profile] = await Promise.all([
            prisma.user.findUnique({
              where: { id: q.providerId },
              select: { id: true, name: true },
            }),
            prisma.taskerProfile.findUnique({
              where: { userId: q.providerId },
              select: { rating: true, completedJobs: true, profileImage: true },
            }),
          ])
          providerRating = profile?.rating ?? 0
          completedJobs = profile?.completedJobs ?? 0
          provider = providerUser
            ? { ...redactSensitive(providerUser, q.providerId === user.id), profileImage: profile?.profileImage ?? null }
            : null
        } else {
          const company = await prisma.companyProfile.findUnique({
            where: { id: q.providerId },
            select: { id: true, userId: true, companyName: true, logo: true, rating: true, completedProjects: true },
          })
          if (company) {
            providerRating = company.rating
            completedJobs = company.completedProjects
            provider = { id: company.id, userId: company.userId, name: company.companyName, profileImage: company.logo }
          }
        }

        return { ...q, price: minorUnitsToMajorUnits(q.price, currency), provider, providerRating, completedJobs }
      })
    )

    const canViewExactLocation =
      isOwner ||
      (!!acceptedQuote && acceptedQuote.status === 'ACCEPTED' && !!job.addressSharedAt)

    return NextResponse.json({
      job: {
        ...job,
        addressStreet: canViewExactLocation ? job.addressStreet : null,
        addressBuilding: canViewExactLocation ? job.addressBuilding : null,
        addressApartment: canViewExactLocation ? job.addressApartment : null,
        addressLandmark: canViewExactLocation ? job.addressLandmark : null,
        latitude: canViewExactLocation ? job.latitude : null,
        longitude: canViewExactLocation ? job.longitude : null,
        budgetAmount: job.budgetAmount != null ? minorUnitsToMajorUnits(job.budgetAmount, currency) : null,
        aiEstimate: job.aiEstimateJson ? JSON.parse(job.aiEstimateJson) : null,
        smartBooking: job.smartBookingJson ? JSON.parse(job.smartBookingJson) : null,
        notifiedCount: job.notifiedCount,
        categoryName: jobCategory?.name || null,
        templateJobName: templateJob?.name || null,
        serviceTemplateName: serviceTemplate?.name || null,
        customer: customer ? redactSensitive(customer, isOwner) : null,
        locationName,
        quotes: enrichedQuotes,
        escrow: escrow ? { ...escrow, amount: minorUnitsToMajorUnits(escrow.amount, currency), serviceFee: minorUnitsToMajorUnits(escrow.serviceFee, currency), totalAmount: minorUnitsToMajorUnits(escrow.totalAmount, currency) } : null,
        workspace: workspace || null,
        reviews: { customerReviews, providerReviews },
        companyAssignment,
        acceptedQuote: acceptedQuote ? { ...acceptedQuote, price: minorUnitsToMajorUnits(acceptedQuote.price, currency), provider: acceptedProvider } : null,
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
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isOwner = job.customerId === user.id
    if (!isOwner) {
      return NextResponse.json({ error: 'Only the customer can edit job details' }, { status: 403 })
    }

    if (!['OPEN', 'QUOTE_ACCEPTED'].includes(job.status)) {
      return NextResponse.json(
        { error: 'Job details are locked after work starts' },
        { status: 409 }
      )
    }

    if (job.status === 'QUOTE_ACCEPTED') {
      const protectedEscrow = await prisma.jobEscrow.findFirst({
        where: { jobId: id, status: 'PROTECTED' },
        select: { id: true },
      })
      if (protectedEscrow) {
        return NextResponse.json(
          { error: 'Booking details are locked after payment is secured' },
          { status: 409 }
        )
      }
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

    if ('preferredTimeSlot' in data) {
      const allowedSlots = ['morning', 'afternoon', 'evening', 'anytime', null]
      if (!allowedSlots.includes(data.preferredTimeSlot)) {
        return NextResponse.json({ error: 'Invalid preferredTimeSlot' }, { status: 400 })
      }
    }

    if (data.preferredDate) {
      const parsedDate = new Date(data.preferredDate)
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid preferredDate' }, { status: 400 })
      }
      data.preferredDate = parsedDate
    }

    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; customerId: string; status: string }[]>`
        SELECT id, "customerId", status
        FROM "MarketplaceJob"
        WHERE id = ${id}
        FOR UPDATE
      `
      const current = locked[0]
      if (!current) throw new Error('EDIT_JOB_NOT_FOUND')
      if (current.customerId !== user.id) throw new Error('EDIT_FORBIDDEN')
      if (!['OPEN', 'QUOTE_ACCEPTED'].includes(current.status)) {
        throw new Error('EDIT_WORK_STARTED')
      }

      if (current.status === 'QUOTE_ACCEPTED') {
        const protectedEscrow = await tx.jobEscrow.findFirst({
          where: { jobId: id, status: 'PROTECTED' },
          select: { id: true },
        })
        if (protectedEscrow) throw new Error('EDIT_PAYMENT_SECURED')
      }

      return tx.marketplaceJob.update({
        where: { id },
        data,
      })
    })

    return NextResponse.json({
      job: {
        ...updated,
        budgetAmount: updated.budgetAmount != null ? minorUnitsToMajorUnits(updated.budgetAmount, getCurrencyForCountry(updated.countryCode)) : null,
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'EDIT_JOB_NOT_FOUND') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      if (error.message === 'EDIT_FORBIDDEN') {
        return NextResponse.json({ error: 'Only the customer can edit job details' }, { status: 403 })
      }
      if (error.message === 'EDIT_WORK_STARTED') {
        return NextResponse.json({ error: 'Job details are locked after work starts' }, { status: 409 })
      }
      if (error.message === 'EDIT_PAYMENT_SECURED') {
        return NextResponse.json({ error: 'Booking details are locked after payment is secured' }, { status: 409 })
      }
    }
    console.error('PATCH job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
