import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { confirmCashPayment } from '@/lib/finance/escrow/escrow-service'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { createNotification } from '@/lib/notifications'
import { minorUnitsToMajorUnits, type Currency } from '@/lib/shared/money/money'

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

    const rateLimitResponse = await requireFinancialRateLimit(request, 'cash-payment')
    if (rateLimitResponse) return rateLimitResponse

    const result = await confirmCashPayment(
      {
        jobId: id,
        actorId: user.id,
        actorType: 'CUSTOMER',
      },
      id,
    )

    const accepted = await prisma.jobQuote.findFirst({
      where: { jobId: id, status: 'ACCEPTED' },
      select: { providerId: true, providerType: true },
    })

    let providerUserId: string | null = null
    if (accepted?.providerType === 'INDIVIDUAL') {
      providerUserId = accepted.providerId
    } else if (accepted?.providerType === 'COMPANY') {
      providerUserId = (
        await prisma.companyProfile.findUnique({
          where: { id: accepted.providerId },
          select: { userId: true },
        })
      )?.userId ?? null
    }

    if (providerUserId && !result.alreadyConfirmed) {
      await createNotification({
        userId: providerUserId,
        title: 'Cash payment selected',
        body: 'The customer selected cash. No funds are held by MaintainEX; platform commission will be recorded when the job is completed.',
        referenceType: 'JOB',
        referenceId: id,
      })
    }

    const currency = result.currency as Currency
    return NextResponse.json({
      success: true,
      escrowId: result.escrowId,
      paymentMethod: 'CASH',
      status: 'CASH_CONFIRMED',
      amountDueMinor: result.amountDue.toString(),
      amountDue: minorUnitsToMajorUnits(result.amountDue, currency),
      currency,
      alreadyConfirmed: result.alreadyConfirmed,
    })
  } catch (error) {
    logger.error('Cash payment selection failed unexpectedly', { err: error, route: '/api/mobile/v2/jobs/[id]/cash-payment', method: 'POST' })
    const message = error instanceof Error ? error.message : 'Cash payment selection failed'

    if (message === 'CASH_PAYMENT_NOT_AVAILABLE_FOR_MARKET') {
      return NextResponse.json(
        {
          error: 'Cash payment is not available for this market.',
          code: 'CASH_PAYMENT_NOT_AVAILABLE_FOR_MARKET',
        },
        { status: 409 },
      )
    }
    if (message === 'PROVIDER_CASH_RESTRICTED') {
      return NextResponse.json(
        {
          error: 'This provider is temporarily unavailable for cash jobs because commission settlement is required. Choose online payment or another provider.',
          code: 'PROVIDER_CASH_RESTRICTED',
        },
        { status: 409 },
      )
    }
    if (message.includes('Only the customer')) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    if (message.includes('not found') || message.includes('not initialized')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (
      message.includes('not ready') ||
      message.includes('can no longer be changed') ||
      message.includes('concurrently') ||
      message.includes('ESCROW_AUTHORIZED_AMOUNT_MISMATCH')
    ) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    return NextResponse.json({ error: 'Cash payment selection failed' }, { status: 500 })
  }
}
