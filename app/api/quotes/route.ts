import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { validateLineItems, calculateQuoteTotal } from '@/lib/pricing/line-items'
import { resolveBenchmark } from '@/lib/pricing/benchmark'
import { classifyQuoteAmount } from '@/lib/pricing/classification'
import type { QuoteLineItemInput } from '@/lib/pricing/benchmark-types'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const suspended = assertNotSuspended(user)
    if (suspended) return suspended

    const body = await request.json()
    const {
      jobId,
      serviceTemplateId,
      countryCode,
      region,
      city,
      currency,
      lineItems,
      notes,
      validUntil,
      parentQuoteId,
      revisionReason,
      estimatedCompletionTime,
      providerType,
      message,
      attachments,
    } = body

    if (!jobId || !serviceTemplateId || !countryCode || !currency) {
      return NextResponse.json(
        { error: 'jobId, serviceTemplateId, countryCode, and currency are required' },
        { status: 400 }
      )
    }

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      )
    }

    if (!estimatedCompletionTime) {
      return NextResponse.json(
        { error: 'estimatedCompletionTime is required' },
        { status: 400 }
      )
    }

    // Validate provider is assigned to this job via the matching system
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: { id: true, categoryId: true, status: true },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'OPEN' && job.status !== 'QUOTE_ACCEPTED') {
      return NextResponse.json(
        { error: `Cannot submit quote for job with status ${job.status}` },
        { status: 409 }
      )
    }

    // Check for existing active quote from this provider
    if (!parentQuoteId) {
      const existingQuote = await prisma.jobQuote.findFirst({
        where: {
          jobId,
          providerId: user.id,
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      })

      if (existingQuote) {
        return NextResponse.json(
          { error: 'You already have an active quote for this job. Submit a revision instead.' },
          { status: 409 }
        )
      }
    }

    // Validate line items (server-side validation)
    const validated = validateLineItems(lineItems as QuoteLineItemInput[], currency)
    if (!validated.valid) {
      return NextResponse.json({ error: 'Line item validation failed', errors: validated.errors }, { status: 400 })
    }

    // Calculate server-side totals
    const totals = calculateQuoteTotal(
      validated.validatedItems.map(item => ({
        totalAmountCents: item.totalAmountCents,
        type: item.type,
      })),
      null,
      null
    )

    // Resolve benchmark for classification
    const benchmark = await resolveBenchmark(prisma, {
      serviceTemplateId,
      countryCode,
      region,
      city,
      currency,
      pricingMode: 'SMART_QUOTE',
    })

    const classification = benchmark
      ? classifyQuoteAmount(totals.serverTotalCents, benchmark)
      : 'INSUFFICIENT_DATA'

    // Determine revision number
    let revisionNumber = 1
    if (parentQuoteId) {
      const parent = await prisma.jobQuote.findUnique({ where: { id: parentQuoteId } })
      if (parent) {
        revisionNumber = parent.revisionNumber + 1
      }
    }

    // Create quote in transaction
    const quote = await prisma.$transaction(async (tx) => {
      // If revision, supersede parent
      if (parentQuoteId) {
        await tx.jobQuote.update({
          where: { id: parentQuoteId },
          data: { status: 'SUPERSEDED' },
        })
      }

      const newQuote = await tx.jobQuote.create({
        data: {
          jobId,
          providerId: user.id,
          providerType: providerType ?? 'INDIVIDUAL',
          price: totals.serverTotalCents,
          currency,
          subtotalCents: totals.serverSubtotalCents,
          taxCents: totals.serverTaxCents,
          totalCents: totals.serverTotalCents,
          benchmarkClassification: classification,
          benchmarkId: benchmark?.benchmarkId ?? null,
          revisionNumber,
          parentQuoteId: parentQuoteId ?? null,
          revisionReason: revisionReason ?? null,
          estimatedCompletionTime,
          message: message ?? notes ?? null,
          attachments: attachments ?? '[]',
          status: 'PENDING',
        },
      })

      // Create line items
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

      return newQuote
    })

    return NextResponse.json({ quote }, { status: 201 })
  } catch (error) {
    console.error('Quote POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
