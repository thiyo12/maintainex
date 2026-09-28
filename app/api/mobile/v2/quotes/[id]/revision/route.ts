import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { createQuoteRevision } from '@/lib/pricing/quote-revision'
import { validateLineItems, calculateQuoteTotal } from '@/lib/pricing/line-items'
import { resolveBenchmark } from '@/lib/pricing/benchmark'
import { classifyQuoteAmount } from '@/lib/pricing/classification'
import type { QuoteLineItemInput } from '@/lib/pricing/benchmark-types'
import { getCurrencyForCountry, parseMajorUnitsInput } from '@/lib/shared/money/money'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: originalQuoteId } = await params
    const body = await request.json()
    const { estimatedCompletionTime, message, attachments, companyId, revisionReason, lineItems, currency } = body

    if (!estimatedCompletionTime || !revisionReason) {
      return NextResponse.json({ error: 'Missing required fields: price, estimatedCompletionTime, revisionReason' }, { status: 400 })
    }

    // Resolve provider identity
    let resolvedProviderId = user.id
    let resolvedProviderType: 'INDIVIDUAL' | 'COMPANY' = 'INDIVIDUAL'
    if (companyId) {
      const { resolveCompanyContext } = await import('@/lib/phase6/company-context')
      const { context: ctx, error: ctxError } = await resolveCompanyContext(user.id, companyId)
      if (ctxError) return ctxError
      if (!ctx) {
        return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 })
      }
      resolvedProviderId = companyId
      resolvedProviderType = 'COMPANY'
    }

    // Fetch the original quote to validate ownership and lifecycle
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
      select: { countryCode: true, categoryId: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const canonicalCurrency = getCurrencyForCountry(job.countryCode)
    if (currency && currency !== canonicalCurrency) {
      return NextResponse.json({ error: 'Quote currency does not match the job market' }, { status: 400 })
    }

    const priceProvided = body.price !== undefined && body.price !== null && body.price !== ''
    const priceMinor = priceProvided ? parseMajorUnitsInput(body.price, canonicalCurrency) : null
    if (priceProvided && priceMinor === null) {
      return NextResponse.json(
        { error: 'Quote price must be a positive amount with at most 2 decimal places' },
        { status: 400 }
      )
    }

    // Validate line items if provided
    let validatedLineItems: Array<QuoteLineItemInput & { totalAmountCents: bigint; sortOrder: number }> = []
    let serverTotalCents = priceMinor ?? originalQuote.price

    if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
      const quoteCurrency = canonicalCurrency
      const validated = validateLineItems(lineItems as QuoteLineItemInput[], quoteCurrency)
      if (!validated.valid) {
        return NextResponse.json({ error: 'Line item validation failed', errors: validated.errors }, { status: 400 })
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
      serverTotalCents = totals.serverTotalCents
    }

    // Resolve benchmark for classification
    let classification = 'INSUFFICIENT_DATA'
    let benchmarkId: string | null = null
    if (job) {
      const benchmark = await resolveBenchmark(prisma, {
        serviceTemplateId: job.categoryId,
        countryCode: job.countryCode,
        currency: canonicalCurrency,
        pricingMode: 'SMART_QUOTE',
      })
      if (benchmark) {
        classification = classifyQuoteAmount(serverTotalCents, benchmark)
        benchmarkId = benchmark.benchmarkId
      }
    }

    // Create revision via the canonical service
    const result = await createQuoteRevision(prisma, {
      originalQuoteId,
      providerId: resolvedProviderId,
      price: priceMinor ?? originalQuote.price,
      estimatedCompletionTime,
      message,
      attachments: attachments ? JSON.stringify(attachments) : undefined,
      revisionReason,
      currency: canonicalCurrency,
      subtotalCents: validatedLineItems.length > 0 ? validatedLineItems.reduce((s, i) => s + i.totalAmountCents, 0n) : undefined,
      taxCents: undefined,
      totalCents: serverTotalCents,
      benchmarkClassification: classification,
      benchmarkId: benchmarkId ?? undefined,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }

    // Persist line items if provided
    if (validatedLineItems.length > 0 && result.newQuoteId) {
      const { persistLineItems } = await import('@/lib/pricing/line-items')
      await persistLineItems(prisma, result.newQuoteId, validatedLineItems)
    }

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
