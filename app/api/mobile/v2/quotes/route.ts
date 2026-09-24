import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { notifyQuoteSubmitted } from '@/lib/notifications'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { resolveQuoteVisibility } from '@/lib/phase6/quote-visibility'
import { findCandidates } from '@/lib/matching'
import { validateQuotePrice } from '@/lib/pricing/engine'
import { checkRateLimit, userKey } from '@/lib/rate-limit/middleware'

function parsePositiveMinorUnits(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value > 0n ? value : null
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return BigInt(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = BigInt(value.trim())
    return parsed > 0n ? parsed : null
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked
    if (user.identityStatus !== 'VERIFIED') {
      return NextResponse.json({ error: 'Identity must be verified before submitting quotes' }, { status: 403 })
    }

    const rateLimit = await checkRateLimit(request, {
      policyName: 'QUOTE_CREATE',
      keyPrefix: 'quote_create',
      identifier: user.id,
    })
    if (!rateLimit.allowed) return rateLimit.response!

    const body = await request.json()
    const { jobId, providerType, estimatedCompletionTime, message, attachments, companyId } = body
    const priceMinor = parsePositiveMinorUnits(body.price)

    if (!jobId || !['INDIVIDUAL', 'COMPANY'].includes(providerType) || priceMinor === null) {
      return NextResponse.json({ error: 'Missing or invalid required fields: jobId, providerType, price' }, { status: 400 })
    }

    let resolvedProviderId = user.id
    let resolvedProviderType: 'INDIVIDUAL' | 'COMPANY' = 'INDIVIDUAL'
    let actorUserId: string | null = null
    let actorRole: string | null = null

    if (providerType === 'COMPANY') {
      if (!companyId) {
        return NextResponse.json({ error: 'companyId is required for company quotes' }, { status: 400 })
      }
      const { context, error } = await resolveCompanyContext(user.id, companyId, 'quotes:submit')
      if (error) return error
      resolvedProviderId = companyId
      resolvedProviderType = 'COMPANY'
      actorUserId = user.id
      actorRole = context!.role
    } else {
      const profile = await prisma.taskerProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
      if (!profile) {
        return NextResponse.json({ error: 'You must have a provider profile to submit quotes' }, { status: 403 })
      }
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status !== 'OPEN') return NextResponse.json({ error: 'Job is not accepting quotes' }, { status: 400 })
    if (job.customerId === user.id) return NextResponse.json({ error: 'Cannot quote on your own job' }, { status: 400 })

    const jobCountry = job.countryCode || 'LK'

    let providerCountry: string
    if (resolvedProviderType === 'COMPANY') {
      const companyProfile = await prisma.companyProfile.findUnique({
        where: { id: resolvedProviderId },
        select: { countryCode: true },
      })
      providerCountry = companyProfile?.countryCode || 'LK'
    } else {
      providerCountry = user.countryCode || 'LK'
    }

    if (providerCountry !== jobCountry) {
      return NextResponse.json({
        error: 'Provider country does not match job country',
        code: 'PROVIDER_COUNTRY_MISMATCH',
      }, { status: 403 })
    }

    const matching = await findCandidates(prisma, {
      jobId: job.id,
      userId: job.customerId,
      jobMode: job.budgetType === 'REQUEST_QUOTES' ? 'QUOTE' : 'BOOK_NOW',
      urgency: (job.urgency?.toUpperCase() || 'NORMAL') as 'NORMAL' | 'URGENT' | 'EMERGENCY',
      categoryId: job.categoryId,
      serviceTemplateId: job.serviceTemplateId || undefined,
      latitude: job.latitude,
      longitude: job.longitude,
      countryCode: job.countryCode || 'GLOBAL',
    })
    const eligible = matching.candidates.some(candidate =>
      candidate.providerType === resolvedProviderType && candidate.providerId === resolvedProviderId
    )
    if (!eligible) {
      const exclusion = matching.excluded.find(candidate =>
        candidate.providerType === resolvedProviderType && candidate.providerId === resolvedProviderId
      )
      return NextResponse.json({
        error: 'Provider is not eligible or does not have the required capability for this job',
        reason: exclusion?.reason || 'CAPABILITY_MISMATCH',
      }, { status: 403 })
    }

    const priceCheck = job.budgetAmount != null ? validateQuotePrice(priceMinor, job.budgetAmount) : { valid: true }
    if (!priceCheck.valid) {
      return NextResponse.json({ error: priceCheck.error }, { status: 400 })
    }

    const existing = await prisma.jobQuote.findFirst({
      where: { jobId, providerId: resolvedProviderId },
    })
    if (existing) return NextResponse.json({ error: 'You already submitted a quote' }, { status: 409 })

    const quote = await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: resolvedProviderId,
        providerType: resolvedProviderType,
        price: priceMinor,
        actorUserId,
        actorRole,
        estimatedCompletionTime: typeof estimatedCompletionTime === 'string' ? estimatedCompletionTime.slice(0, 200) : '',
        message: typeof message === 'string' ? message.slice(0, 5000) : '',
        attachments: JSON.stringify(Array.isArray(attachments) ? attachments : []),
      },
    })

    if (job.responseState === 'awaiting') {
      await prisma.marketplaceJob.updateMany({
        where: { id: jobId, responseState: 'awaiting' },
        data: { responseState: 'responded' },
      })
    }

    notifyQuoteSubmitted(jobId, job.customerId, user.name || 'A provider')

    return NextResponse.json({ quote: { ...quote, price: quote.price.toString() } }, { status: 201 })
  } catch (error) {
    console.error('Create quote error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })
    const companyId = searchParams.get('companyId')

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const { allowedQuoteIds, isCustomer } = await resolveQuoteVisibility(prisma, {
      userId: user.id,
      jobId,
      companyId,
    })

    if (!isCustomer && allowedQuoteIds.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const quotes = isCustomer
      ? await prisma.jobQuote.findMany({ where: { jobId }, orderBy: { price: 'asc' } })
      : await prisma.jobQuote.findMany({ where: { id: { in: allowedQuoteIds } }, orderBy: { price: 'asc' } })

    const enriched = await Promise.all(
      quotes.map(async (q) => {
        let provider: { id: string; name?: string | null; chatUserId?: string | null } | null = null
        let rating = 0
        let completedJobs = 0

        if (q.providerType === 'INDIVIDUAL') {
          const providerUser = await prisma.user.findUnique({
            where: { id: q.providerId },
            select: { id: true, name: true },
          })
          provider = providerUser
            ? { id: providerUser.id, name: providerUser.name, chatUserId: providerUser.id }
            : null
          const p = await prisma.taskerProfile.findUnique({
            where: { userId: q.providerId },
            select: { rating: true, completedJobs: true },
          })
          if (p) { rating = p.rating; completedJobs = p.completedJobs }
        } else {
          const companyProfile = await prisma.companyProfile.findUnique({
            where: { id: q.providerId },
            select: { id: true, userId: true, companyName: true, rating: true, completedProjects: true },
          })
          provider = companyProfile
            ? { id: companyProfile.id, name: companyProfile.companyName, chatUserId: companyProfile.userId }
            : { id: q.providerId }
          if (companyProfile) { rating = companyProfile.rating; completedJobs = companyProfile.completedProjects }
        }

        return { ...q, price: q.price.toString(), provider: provider || { id: q.providerId }, providerRating: rating, completedJobs }
      })
    )

    return NextResponse.json({ quotes: enriched })
  } catch (error) {
    console.error('Get quotes error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
