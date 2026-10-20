import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent, getPaymentStatus, resolvePaymentMarketForIntent } from '@/lib/payment/payment-service'
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

    // Phase 02/03: payment creation follows the same authoritative market as the
    // display path. Previously POST created intents from the stored job country
    // alone, so a job whose validated address disagreed with its stored country
    // could still start checkout.
    const paymentJob = await prisma.marketplaceJob.findUnique({
      where: { id },
      select: { id: true, customerId: true, countryCode: true, latitude: true, longitude: true },
    })
    if (!paymentJob) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (paymentJob.customerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const paymentMarket = resolvePaymentMarketForIntent(paymentJob)
    if (!paymentMarket.ok) {
      return NextResponse.json(
        { error: paymentMarket.error, code: paymentMarket.code },
        { status: 409 }
      )
    }

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
    logger.error('Payment intent creation failed unexpectedly', { err: error, route: '/api/mobile/v2/jobs/[id]/payment', method: 'POST' })
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

    // Phase 02/03: coordinates MUST be selected here. Without them the market
    // resolver falls back to the stored country, which would let GET report
    // cash/online availability for a job whose validated address sits outside
    // the authorized market.
    const job = await prisma.marketplaceJob.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        countryCode: true,
        latitude: true,
        longitude: true,
        workersCount: true,
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

    // Preserve existing financial history while withholding all new checkout
    // options on not-yet-supported crew bookings. This is a read-only gate.
    if ((job.workersCount ?? 1) !== 1) {
      return NextResponse.json({
        payment,
        options: null,
        market: { valid: false, code: 'CREW_PAYMENT_NOT_ENABLED',
          error: 'Crew payment activation is not available' },
      })
    }

    // Phase 02/03: payment display uses the SAME resolver as payment intent
    // creation, so GET and POST can never disagree about whether a job's market
    // is valid. Previously GET used the coordinate-only resolver and would offer
    // cash/online options for a job POST refuses on a market mismatch.
    const jobMarket = resolvePaymentMarketForIntent(job)
    if (!jobMarket.ok) {
      // An unconfirmable market must never yield payment options, but it must not
      // hide settled financial history either: the owning customer still needs to
      // read what was already paid. Refunds, captures, and reconciliation run
      // through their own escrow/admin workflows and are unaffected.
      return NextResponse.json({
        payment,
        options: null,
        market: { valid: false, code: jobMarket.code, error: jobMarket.error },
      })
    }
    const authoritativeCountryCode = jobMarket.countryCode

    let onlineProvider: Awaited<ReturnType<typeof resolvePaymentProviderForMarket>> = null
    let cashFinanciallyAllowed = false
    let onlineFinanciallyAllowed = false

    if (
      escrow &&
      acceptedQuote &&
      (acceptedQuote.providerType === 'INDIVIDUAL' || acceptedQuote.providerType === 'COMPANY')
    ) {
      onlineProvider = await resolvePaymentProviderForMarket({
        countryCode: authoritativeCountryCode,
        currency: escrow.currency,
      })

      const standing = await prisma.$transaction(async tx => {
        const identity = await ensureProviderIdentity(tx, {
          providerId: acceptedQuote.providerId,
          providerType: acceptedQuote.providerType as 'INDIVIDUAL' | 'COMPANY',
          countryCode: authoritativeCountryCode,
        })
        return evaluateStoredProviderFinancialStanding(tx, {
          providerIdentityId: identity.id,
          providerType: acceptedQuote.providerType as 'INDIVIDUAL' | 'COMPANY',
          countryCode: authoritativeCountryCode,
          currency: escrow.currency,
        })
      })

      cashFinanciallyAllowed = standing.decision.cashJobsAllowed
      onlineFinanciallyAllowed = standing.decision.onlineJobsAllowed
    }

    const cashMarketAvailable = Boolean(
      escrow &&
      isCashPaymentAvailableForMarket(authoritativeCountryCode, escrow.currency)
    )
    const onlineMarketAvailable = Boolean(onlineProvider)

    const options = {
      countryCode: authoritativeCountryCode,
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
    logger.error('Payment status read failed unexpectedly', { err: error, route: '/api/mobile/v2/jobs/[id]/payment', method: 'GET' })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
