import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { createQuoteRevision } from '@/lib/pricing/quote-revision'
import { validateLineItems, calculateQuoteTotal, persistLineItems } from '@/lib/pricing/line-items'
import { resolveBenchmark } from '@/lib/pricing/benchmark'
import { classifyQuoteAmount } from '@/lib/pricing/classification'
import type { QuoteLineItemInput } from '@/lib/pricing/benchmark-types'
import { getCurrencyForCountry, parseMajorUnitsInput } from '@/lib/shared/money/money'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { findCandidates } from '@/lib/matching'
import { notifyQuoteSubmitted } from '@/lib/notifications'
import { checkRateLimit } from '@/lib/rate-limit/middleware'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    if (user.identityStatus !== 'VERIFIED') {
      return NextResponse.json(
        { error: 'Identity must be verified before revising quotes' },
        { status: 403 }
      )
    }

    const rateLimit = await checkRateLimit(request, {
      policyName: 'QUOTE_CREATE',
      keyPrefix: 'quote_revision',
      identifier: user.id,
    })
    if (!rateLimit.allowed) return rateLimit.response!

    const { id: originalQuoteId } = await params
    if (!originalQuoteId || originalQuoteId.length > 128) {
      return NextResponse.json({ error: 'Invalid quote ID' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      estimatedCompletionTime,
      message,
      attachments,
      companyId,
      revisionReason,
      lineItems,
      currency,
    } = body

    if (
      typeof estimatedCompletionTime !== 'string' ||
      !estimatedCompletionTime.trim() ||
      typeof revisionReason !== 'string' ||
      revisionReason.trim().length < 3
    ) {
      return NextResponse.json(
        { error: 'estimatedCompletionTime and revisionReason are required' },
        { status: 400 }
      )
    }

    let resolvedProviderId = user.id
    let resolvedProviderType: 'INDIVIDUAL' | 'COMPANY' = 'INDIVIDUAL'

    if (companyId !== undefined && companyId !== null && companyId !== '') {
      if (typeof companyId !== 'string' || companyId.length > 128) {
        return NextResponse.json({ error: 'Invalid companyId' }, { status: 400 })
      }

      const { context, error } = await resolveCompanyContext(
        user.id,
        companyId,
        'quotes:submit'
      )
      if (error) return error
      resolvedProviderId = context!.companyId
      resolvedProviderType = 'COMPANY'
    } else {
      const tasker = await prisma.taskerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!tasker) {
        return NextResponse.json(
          { error: 'You must have a provider profile to revise an individual quote' },
          { status: 403 }
        )
      }
    }

    const originalQuote = await prisma.jobQuote.findUnique({
      where: { id: originalQuoteId },
      select: {
        id: true,
        jobId: true,
        providerId: true,
        providerType: true,
        status: true,
        price: true,
        currency: true,
        revisionNumber: true,
        parentQuoteId: true,
      },
    })

    if (!originalQuote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (
      originalQuote.providerId !== resolvedProviderId ||
      originalQuote.providerType !== resolvedProviderType
    ) {
      return NextResponse.json({ error: 'Not your quote' }, { status: 403 })
    }

    if (originalQuote.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot revise a quote with status ${originalQuote.status}. Only PENDING quotes can be revised.` },
        { status: 409 }
      )
    }

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: originalQuote.jobId },
      select: {
        id: true,
        customerId: true,
        countryCode: true,
        categoryId: true,
        serviceTemplateId: true,
        budgetType: true,
        urgency: true,
        latitude: true,
        longitude: true,
        preferredDate: true,
        status: true,
      },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    if (job.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Quote revisions are only allowed while the job is open' },
        { status: 409 }
      )
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
      preferredDate: job.preferredDate,
    })

    const eligible = matching.candidates.some(candidate =>
      candidate.providerType === resolvedProviderType &&
      candidate.providerId === resolvedProviderId
    )
    if (!eligible) {
      const exclusion = matching.excluded.find(candidate =>
        candidate.providerType === resolvedProviderType &&
        candidate.providerId === resolvedProviderId
      )
      return NextResponse.json(
        {
          error: 'Provider is no longer eligible to revise this quote',
          reason: exclusion?.reason || 'CAPABILITY_MISMATCH',
        },
        { status: 403 }
      )
    }

    const canonicalCurrency = getCurrencyForCountry(job.countryCode)
    if (currency && currency !== canonicalCurrency) {
      return NextResponse.json(
        { error: 'Quote currency does not match the job market' },
        { status: 400 }
      )
    }

    const priceProvided = body.price !== undefined && body.price !== null && body.price !== ''
    const priceMinor = priceProvided ? parseMajorUnitsInput(body.price, canonicalCurrency) : null
    if (priceProvided && priceMinor === null) {
      return NextResponse.json(
        { error: 'Quote price must be a positive amount with at most 2 decimal places' },
        { status: 400 }
      )
    }

    let validatedLineItems: Array<QuoteLineItemInput & { totalAmountCents: bigint; sortOrder: number }> = []
    let serverSubtotalCents: bigint | undefined
    let serverTaxCents: bigint | undefined
    let serverTotalCents = priceMinor ?? originalQuote.price

    if (Array.isArray(lineItems) && lineItems.length > 0) {
      const validated = validateLineItems(lineItems as QuoteLineItemInput[], canonicalCurrency)
      if (!validated.valid) {
        return NextResponse.json(
          { error: 'Line item validation failed', errors: validated.errors },
          { status: 400 }
        )
      }

      validatedLineItems = validated.validatedItems
      const totals = calculateQuoteTotal(
        validated.validatedItems.map(item => ({
          totalAmountCents: item.totalAmountCents,
          type: item.type,
        })),
        null,
        null
      )
      serverSubtotalCents = totals.serverSubtotalCents
      serverTaxCents = totals.serverTaxCents
      serverTotalCents = totals.serverTotalCents
    }

    let classification = 'INSUFFICIENT_DATA'
    let benchmarkId: string | null = null
    if (job.serviceTemplateId) {
      const benchmark = await resolveBenchmark(prisma, {
        serviceTemplateId: job.serviceTemplateId,
        countryCode: job.countryCode,
        currency: canonicalCurrency,
        pricingMode: 'SMART_QUOTE',
      })
      if (benchmark) {
        classification = classifyQuoteAmount(serverTotalCents, benchmark)
        benchmarkId = benchmark.benchmarkId
      }
    }

    const safeAttachments = Array.isArray(attachments)
      ? JSON.stringify(attachments.slice(0, 20))
      : typeof attachments === 'string'
        ? attachments.slice(0, 20000)
        : undefined

    const result = await createQuoteRevision(prisma, {
      originalQuoteId,
      providerId: resolvedProviderId,
      price: serverTotalCents,
      estimatedCompletionTime: estimatedCompletionTime.trim().slice(0, 200),
      message: typeof message === 'string' ? message.slice(0, 5000) : undefined,
      attachments: safeAttachments,
      revisionReason: revisionReason.trim().slice(0, 1000),
      currency: canonicalCurrency,
      subtotalCents: serverSubtotalCents,
      taxCents: serverTaxCents,
      totalCents: serverTotalCents,
      benchmarkClassification: classification,
      benchmarkId: benchmarkId ?? undefined,
    })

    if (!result.success || !result.newQuoteId) {
      return NextResponse.json({ error: result.error || 'Quote revision failed' }, { status: 409 })
    }

    if (validatedLineItems.length > 0) {
      await persistLineItems(prisma, result.newQuoteId, validatedLineItems)
    }

    await notifyQuoteSubmitted(job.id, job.customerId, user.name || 'A provider')

    return NextResponse.json({
      success: true,
      newQuoteId: result.newQuoteId,
      revisionNumber: (originalQuote.revisionNumber || 1) + 1,
    }, { status: 201 })
  } catch (error) {
    console.error('Quote revision error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
