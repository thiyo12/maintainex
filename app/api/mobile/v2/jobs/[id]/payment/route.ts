import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent, getPaymentStatus } from '@/lib/payment/payment-service'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { resolvePaymentPublicOrigin } from '@/lib/finance/payments/public-origin'
import { prisma } from '@/lib/prisma'
import {
  isCashPaymentAvailableForMarket,
  resolvePaymentProviderForMarket,
} from '@/lib/finance/payments/provider-registry'
import {
  ensureProviderIdentity,
  evaluateStoredProviderFinancialStanding,
} from '@/lib/finance/commissions/provider-balance-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const rateLimitResponse = await requireFinancialRateLimit(request, 'payment-intent')
    if (rateLimitResponse) return rateLimitResponse

    const baseUrl = resolvePaymentPublicOrigin(request.url)
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Payment public URL is not configured', code: 'PAYMENT_ORIGIN_NOT_CONFIGURED' },
        { status: 503 }
      )
    }

    const result = await createPaymentIntent({
      jobId: id,
      customerId: user.id,
      baseUrl,
    })

    if (!result.success) {
      const status =
        result.code === 'UNAUTHORIZED' ? 403 :
        result.code === 'JOB_NOT_FOUND' ? 404 :
        [
          'PAYPAL_NOT_CONFIGURED',
          'PAYMENT_PROVIDER_NOT_AVAILABLE',
          'PAYPAL_ENVIRONMENT_MISMATCH',
          'PAYMENT_PROVIDER_CHECKOUT_UNSUPPORTED',
        ].includes(result.code || '') ? 503 :
        result.code === 'CUSTOMER_PAYMENT_DETAILS_REQUIRED' ? 400 :
        409
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Create payment intent error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        countryCode: true,
      },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [payment, escrow, acceptedQuote] = await Promise.all([
      getPaymentStatus(id, user.id),
      prisma.jobEscrow.findFirst({
        where: { jobId: id },
        orderBy: { createdAt: 'desc' },
        select: { currency: true, status: true },
      }),
      prisma.jobQuote.findFirst({
        where: { jobId: id, status: 'ACCEPTED' },
        select: { providerId: true, providerType: true },
      }),
    ])

    let onlineProvider: Awaited<ReturnType<typeof resolvePaymentProviderForMarket>> = null
    let cashFinanciallyAllowed = false
    let onlineFinanciallyAllowed = false

    if (
      escrow &&
      acceptedQuote &&
      (acceptedQuote.providerType === 'INDIVIDUAL' || acceptedQuote.providerType === 'COMPANY')
    ) {
      onlineProvider = await resolvePaymentProviderForMarket({
        countryCode: job.countryCode,
        currency: escrow.currency,
      })

      const standing = await prisma.$transaction(async tx => {
        const identity = await ensureProviderIdentity(tx, {
          providerId: acceptedQuote.providerId,
          providerType: acceptedQuote.providerType as 'INDIVIDUAL' | 'COMPANY',
          countryCode: job.countryCode,
        })
        return evaluateStoredProviderFinancialStanding(tx, {
          providerIdentityId: identity.id,
          providerType: acceptedQuote.providerType as 'INDIVIDUAL' | 'COMPANY',
          countryCode: job.countryCode,
          currency: escrow.currency,
        })
      })

      cashFinanciallyAllowed = standing.decision.cashJobsAllowed
      onlineFinanciallyAllowed = standing.decision.onlineJobsAllowed
    }

    const cashMarketAvailable = Boolean(
      escrow &&
      isCashPaymentAvailableForMarket(job.countryCode, escrow.currency)
    )
    const onlineMarketAvailable = Boolean(onlineProvider)

    const options = {
      countryCode: job.countryCode,
      currency: escrow?.currency || null,
      cash: {
        available: cashMarketAvailable && cashFinanciallyAllowed,
        marketAvailable: cashMarketAvailable,
        financiallyAllowed: cashFinanciallyAllowed,
        reason: !cashMarketAvailable
          ? 'NOT_AVAILABLE_FOR_MARKET'
          : !cashFinanciallyAllowed
            ? 'PROVIDER_CASH_RESTRICTED'
            : null,
      },
      online: {
        available: onlineMarketAvailable && onlineFinanciallyAllowed,
        marketAvailable: onlineMarketAvailable,
        financiallyAllowed: onlineFinanciallyAllowed,
        provider: onlineProvider?.provider || null,
        paymentMethods: onlineProvider?.paymentMethods || [],
        reason: !onlineMarketAvailable
          ? 'NO_VERIFIED_ONLINE_PROVIDER'
          : !onlineFinanciallyAllowed
            ? 'PROVIDER_ONLINE_RESTRICTED'
            : null,
      },
    }

    return NextResponse.json({ payment, options })
  } catch (error) {
    console.error('Payment status error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
