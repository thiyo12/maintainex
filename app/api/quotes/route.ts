import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { validateLineItems, calculateQuoteTotal } from '@/lib/pricing/line-items'
import { resolveBenchmark } from '@/lib/pricing/benchmark'
import { classifyQuoteAmount } from '@/lib/pricing/classification'
import { createQuoteRevision } from '@/lib/pricing/quote-revision'
import type { QuoteLineItemInput } from '@/lib/pricing/benchmark-types'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { findCandidates } from '@/lib/matching'
import { notifyQuoteSubmitted } from '@/lib/notifications'
import { checkRateLimit } from '@/lib/rate-limit/middleware'
import { getCurrencyForCountry, minorUnitsToMajorUnits } from '@/lib/shared/money/money'
import { lockAndAssertProviderAvailable } from '@/lib/domain/provider-availability'

function serialiseQuote(quote: any, currency: string) {
  return {
    ...quote,
    price: minorUnitsToMajorUnits(quote.price, currency),
    subtotalCents: quote.subtotalCents?.toString?.() ?? null,
    taxCents: quote.taxCents?.toString?.() ?? null,
    totalCents: quote.totalCents?.toString?.() ?? null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    if (user.identityStatus !== 'VERIFIED') {
      return NextResponse.json(
        { error: 'Identity must be verified before submitting quotes' },
        { status: 403 }
      )
    }

    const rateLimit = await checkRateLimit(request, {
      policyName: 'QUOTE_CREATE',
      keyPrefix: 'quote_create',
      identifier: user.id,
    })
    if (!rateLimit.allowed) return rateLimit.response!

    const body = await request.json().catch(() => ({}))
    const {
      jobId,
      serviceTemplateId,
      countryCode,
      region,
      city,
      currency,
      lineItems,
      notes,
      parentQuoteId,
      revisionReason,
      estimatedCompletionTime,
      providerType,
      companyId,
      message,
      attachments,
    } = body

    if (!jobId || typeof jobId !== 'string' || jobId.length > 128) {
      return NextResponse.json({ error: 'Valid jobId is required' }, { status: 400 })
    }
    if (!serviceTemplateId || typeof serviceTemplateId !== 'string' || serviceTemplateId.length > 128) {
      return NextResponse.json({ error: 'Valid serviceTemplateId is required' }, { status: 400 })
    }
    if (!countryCode || typeof countryCode !== 'string' || !currency || typeof currency !== 'string') {
      return NextResponse.json({ error: 'countryCode and currency are required' }, { status: 400 })
    }
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
    }
    if (typeof estimatedCompletionTime !== 'string' || !estimatedCompletionTime.trim()) {
      return NextResponse.json({ error: 'estimatedCompletionTime is required' }, { status: 400 })
    }

    const requestedProviderType =
      providerType === undefined || providerType === 'INDIVIDUAL'
        ? 'INDIVIDUAL'
        : providerType === 'COMPANY'
          ? 'COMPANY'
          : null

    if (!requestedProviderType) {
      return NextResponse.json({ error: 'providerType must be INDIVIDUAL or COMPANY' }, { status: 400 })
    }

    let resolvedProviderId = user.id
    let resolvedProviderType: 'INDIVIDUAL' | 'COMPANY' = 'INDIVIDUAL'
    let actorUserId: string | null = null
    let actorRole: string | null = null

    if (requestedProviderType === 'COMPANY') {
      if (typeof companyId !== 'string' || !companyId || companyId.length > 128) {
        return NextResponse.json({ error: 'companyId is required for company quotes' }, { status: 400 })
      }
      const { context, error } = await resolveCompanyContext(user.id, companyId, 'quotes:submit')
      if (error) return error
      resolvedProviderId = companyId
      resolvedProviderType = 'COMPANY'
      actorUserId = user.id
      actorRole = context!.role
    } else {
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!profile) {
        return NextResponse.json(
          { error: 'You must have a provider profile to submit quotes' },
          { status: 403 }
        )
      }
    }

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        customerId: true,
        categoryId: true,
        serviceTemplateId: true,
        countryCode: true,
        budgetType: true,
        urgency: true,
        latitude: true,
        longitude: true,
        preferredDate: true,
        status: true,
        responseState: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.status !== 'OPEN') {
      return NextResponse.json({ error: 'Job is not accepting quotes' }, { status: 409 })
    }
    if (job.customerId === user.id) {
      return NextResponse.json({ error: 'Cannot quote on your own job' }, { status: 400 })
    }

    const canonicalCountry = (job.countryCode || 'LK').toUpperCase()
    if (countryCode.toUpperCase() !== canonicalCountry) {
      return NextResponse.json({ error: 'Quote country does not match the job market' }, { status: 400 })
    }

    const canonicalCurrency = getCurrencyForCountry(canonicalCountry)
    if (currency.toUpperCase() !== canonicalCurrency) {
      return NextResponse.json({ error: 'Quote currency does not match the job market' }, { status: 400 })
    }

    let canonicalTemplateId = job.serviceTemplateId
    if (canonicalTemplateId) {
      if (serviceTemplateId !== canonicalTemplateId) {
        return NextResponse.json({ error: 'Quote service template does not match the job' }, { status: 400 })
      }
    } else {
      const template = await prisma.serviceTemplate.findUnique({
        where: { id: serviceTemplateId },
        select: { id: true, jobCategoryId: true },
      })
      if (!template || template.jobCategoryId !== job.categoryId) {
        return NextResponse.json({ error: 'Service template does not belong to the job category' }, { status: 400 })
      }
      canonicalTemplateId = template.id
    }

    const matching = await findCandidates(prisma, {
      jobId: job.id,
      userId: job.customerId,
      jobMode: job.budgetType === 'REQUEST_QUOTES' ? 'QUOTE' : 'BOOK_NOW',
      urgency: (job.urgency?.toUpperCase() || 'NORMAL') as 'NORMAL' | 'URGENT' | 'EMERGENCY',
      categoryId: job.categoryId,
      serviceTemplateId: canonicalTemplateId,
      latitude: job.latitude,
      longitude: job.longitude,
      countryCode: canonicalCountry,
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
          error: 'Provider is not eligible or does not have the required capability for this job',
          reason: exclusion?.reason || 'CAPABILITY_MISMATCH',
        },
        { status: 403 }
      )
    }

    const validated = validateLineItems(lineItems as QuoteLineItemInput[], canonicalCurrency)
    if (!validated.valid) {
      return NextResponse.json(
        { error: 'Line item validation failed', errors: validated.errors },
        { status: 400 }
      )
    }

    const totals = calculateQuoteTotal(
      validated.validatedItems.map(item => ({
        totalAmountCents: item.totalAmountCents,
        type: item.type,
      })),
      null,
      null
    )

    const benchmark = await resolveBenchmark(prisma, {
      serviceTemplateId: canonicalTemplateId,
      countryCode: canonicalCountry,
      region: typeof region === 'string' ? region.slice(0, 120) : undefined,
      city: typeof city === 'string' ? city.slice(0, 120) : undefined,
      currency: canonicalCurrency,
      pricingMode: 'SMART_QUOTE',
    })

    const classification = benchmark
      ? classifyQuoteAmount(totals.serverTotalCents, benchmark)
      : 'INSUFFICIENT_DATA'

    const safeMessage =
      typeof message === 'string'
        ? message.slice(0, 5000)
        : typeof notes === 'string'
          ? notes.slice(0, 5000)
          : null
    const safeAttachments = Array.isArray(attachments)
      ? JSON.stringify(attachments.slice(0, 20))
      : typeof attachments === 'string'
        ? attachments.slice(0, 20000)
        : '[]'
    const completionTime = estimatedCompletionTime.trim().slice(0, 200)

    if (parentQuoteId) {
      if (typeof parentQuoteId !== 'string' || parentQuoteId.length > 128) {
        return NextResponse.json({ error: 'Invalid parentQuoteId' }, { status: 400 })
      }
      if (typeof revisionReason !== 'string' || revisionReason.trim().length < 3) {
        return NextResponse.json({ error: 'revisionReason is required for a quote revision' }, { status: 400 })
      }

      const parent = await prisma.jobQuote.findUnique({
        where: { id: parentQuoteId },
        select: {
          id: true,
          jobId: true,
          providerId: true,
          providerType: true,
          status: true,
        },
      })
      if (!parent) {
        return NextResponse.json({ error: 'Parent quote not found' }, { status: 404 })
      }
      if (
        parent.jobId !== job.id ||
        parent.providerId !== resolvedProviderId ||
        parent.providerType !== resolvedProviderType
      ) {
        return NextResponse.json({ error: 'Not your quote revision chain' }, { status: 403 })
      }
      if (parent.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Cannot revise a quote with status ${parent.status}` },
          { status: 409 }
        )
      }

      const revision = await createQuoteRevision(prisma, {
        originalQuoteId: parent.id,
        providerId: resolvedProviderId,
        price: totals.serverTotalCents,
        estimatedCompletionTime: completionTime,
        message: safeMessage || undefined,
        attachments: safeAttachments,
        revisionReason: revisionReason.trim().slice(0, 1000),
        currency: canonicalCurrency,
        subtotalCents: totals.serverSubtotalCents,
        taxCents: totals.serverTaxCents,
        totalCents: totals.serverTotalCents,
        benchmarkClassification: classification,
        benchmarkId: benchmark?.benchmarkId || undefined,
        lineItems: validated.validatedItems,
      })
      if (!revision.success || !revision.newQuoteId) {
        return NextResponse.json({ error: revision.error || 'Quote revision failed' }, { status: 409 })
      }


      const revisedQuote = await prisma.jobQuote.findUnique({ where: { id: revision.newQuoteId } })
      if (!revisedQuote) {
        return NextResponse.json({ error: 'Revised quote could not be loaded' }, { status: 500 })
      }

      await notifyQuoteSubmitted(job.id, job.customerId, user.name || 'A provider')
      return NextResponse.json(
        { quote: serialiseQuote(revisedQuote, canonicalCurrency) },
        { status: 201 }
      )
    }

    const quote = await prisma.$transaction(async tx => {
      await lockAndAssertProviderAvailable(
        tx,
        resolvedProviderType,
        resolvedProviderId,
        'Provider is no longer available to submit this quote',
      )

      const lockedJobs = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status
        FROM "MarketplaceJob"
        WHERE id = ${job.id}
        FOR UPDATE
      `
      const lockedJob = lockedJobs[0]
      if (!lockedJob) throw new Error('JOB_NOT_FOUND')
      if (lockedJob.status !== 'OPEN') throw new Error('JOB_NO_LONGER_OPEN')

      const existingQuote = await tx.jobQuote.findFirst({
        where: {
          jobId: job.id,
          providerId: resolvedProviderId,
          providerType: resolvedProviderType,
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
        select: { id: true },
      })
      if (existingQuote) throw new Error('ACTIVE_QUOTE_EXISTS')

      const newQuote = await tx.jobQuote.create({
        data: {
          jobId: job.id,
          providerId: resolvedProviderId,
          providerType: resolvedProviderType,
          actorUserId,
          actorRole,
          price: totals.serverTotalCents,
          currency: canonicalCurrency,
          subtotalCents: totals.serverSubtotalCents,
          taxCents: totals.serverTaxCents,
          totalCents: totals.serverTotalCents,
          benchmarkClassification: classification,
          benchmarkId: benchmark?.benchmarkId ?? null,
          revisionNumber: 1,
          parentQuoteId: null,
          revisionReason: null,
          estimatedCompletionTime: completionTime,
          message: safeMessage,
          attachments: safeAttachments,
          status: 'PENDING',
        },
      })

      for (const item of validated.validatedItems) {
        await tx.quoteLineItem.create({
          data: {
            quoteId: newQuote.id,
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit ?? null,
            unitAmountCents: item.unitAmountCents,
            totalAmountCents: item.totalAmountCents,
            currency: item.currency,
            sortOrder: item.sortOrder,
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
          },
        })
      }

      if (job.responseState === 'awaiting') {
        await tx.marketplaceJob.updateMany({
          where: { id: job.id, responseState: 'awaiting' },
          data: { responseState: 'responded' },
        })
      }

      return newQuote
    })

    await notifyQuoteSubmitted(job.id, job.customerId, user.name || 'A provider')

    return NextResponse.json(
      { quote: serialiseQuote(quote, canonicalCurrency) },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTIVE_QUOTE_EXISTS') {
      return NextResponse.json(
        { error: 'You already have an active quote for this job. Submit a revision instead.' },
        { status: 409 }
      )
    }
    if (error instanceof Error && error.message === 'JOB_NOT_FOUND') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'JOB_NO_LONGER_OPEN') {
      return NextResponse.json({ error: 'Job is no longer accepting quotes' }, { status: 409 })
    }
    if (error instanceof Error && error.message.includes('Provider is no longer available')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('Quote POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
