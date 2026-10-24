import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { recordJobLifecycleEvent } from '@/lib/domain/job-lifecycle-audit'
import { isCashPaymentAvailableForMarket } from '@/lib/finance/payments/provider-registry'
import { resolvePaymentMarketForIntent } from '@/lib/finance/payments/payment-service'
import { minorUnitsToMajorUnits, type Currency } from '@/lib/shared/money/money'
import { decideCashCollectionReport } from '@/lib/finance/payments/cash-collection-state'

type CollectionAction = 'REPORT' | 'CONFIRM' | 'CONTEST'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params
    const actor = await authenticateRequest(request)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(actor)
    if (blocked) return blocked

    const rateLimit = await requireFinancialRateLimit(request, 'cash-payment')
    if (rateLimit) return rateLimit

    const body = await request.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action.trim().toUpperCase() as CollectionAction : null
    if (!action || !['REPORT', 'CONFIRM', 'CONTEST'].includes(action)) {
      return NextResponse.json({ error: 'action must be REPORT, CONFIRM or CONTEST' }, { status: 400 })
    }

    const [job, escrow, quote] = await Promise.all([
      prisma.marketplaceJob.findUnique({ where: { id: jobId } }),
      prisma.jobEscrow.findFirst({ where: { jobId }, orderBy: { createdAt: 'desc' } }),
      prisma.jobQuote.findFirst({ where: { jobId, status: 'ACCEPTED' } }),
    ])
    if (!job || !escrow || !quote) return NextResponse.json({ error: 'Cash booking not found' }, { status: 404 })
    if (escrow.paymentMethod !== 'CASH') {
      return NextResponse.json({ error: 'This booking is not a cash payment' }, { status: 409 })
    }
    const market = resolvePaymentMarketForIntent(job)
    if (!market.ok || !isCashPaymentAvailableForMarket(market.countryCode, escrow.currency)) {
      return NextResponse.json({ error: 'Cash collection is not available for this market' }, { status: 409 })
    }

    const isCustomer = job.customerId === actor.id
    let isAuthorizedProvider = quote.providerType === 'INDIVIDUAL' && quote.providerId === actor.id
    if (quote.providerType === 'COMPANY') {
      const [companyOwner, assignedWorker] = await Promise.all([
        prisma.companyProfile.findFirst({
          where: { id: quote.providerId, userId: actor.id }, select: { id: true },
        }),
        prisma.companyJobAssignment.findFirst({
          where: {
            jobId, companyId: quote.providerId, workerUserId: actor.id,
            status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
          }, select: { id: true },
        }),
      ])
      isAuthorizedProvider = Boolean(companyOwner || assignedWorker)
    }

    if (action === 'REPORT' && !isAuthorizedProvider) {
      return NextResponse.json({ error: 'Only the selected provider or assigned company worker can report collection' }, { status: 403 })
    }
    if (action !== 'REPORT' && !isCustomer) {
      return NextResponse.json({ error: 'Only the customer can confirm or contest the reported amount' }, { status: 403 })
    }
    if (job.status !== 'IN_PROGRESS' && job.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Cash collection can be reported only during or after work' }, { status: 409 })
    }

    let amountMinor: bigint | null = null
    if (action === 'REPORT') {
      const raw = body?.amountMinor
      if (typeof raw !== 'string' || !/^\d{1,18}$/.test(raw)) {
        return NextResponse.json({ error: 'amountMinor must be a non-negative integer string' }, { status: 400 })
      }
      amountMinor = BigInt(raw)
      if (amountMinor > escrow.totalAmount) {
        return NextResponse.json({ error: 'Reported cash cannot exceed the accepted invoice total' }, { status: 400 })
      }
    }

    const updated = await prisma.$transaction(async tx => {
      const currentEscrow = await tx.jobEscrow.findUnique({
        where: { id: escrow.id },
        select: { status: true, cashCollectionStatus: true, cashCollectedMinor: true, cashReportedBy: true },
      })
      const current = currentEscrow?.cashCollectionStatus || null
      if (!currentEscrow || !current) throw new Error('CASH_COLLECTION_NOT_FOUND')
      if (action === 'REPORT' && currentEscrow.status === 'RELEASED') {
        throw new Error('CASH_COLLECTION_AFTER_RELEASE_REQUIRES_RECONCILIATION')
      }

      // Retries after a lost response return the existing attestation without
      // duplicating lifecycle events or changing the reported amount.
      const reportDecision = action === 'REPORT'
        ? decideCashCollectionReport({
          status: current,
          previousAmountMinor: currentEscrow.cashCollectedMinor,
          reportedAmountMinor: amountMinor!,
          sameReporter: currentEscrow.cashReportedBy === actor.id,
        })
        : null
      if (
        (action === 'REPORT' && reportDecision === 'RETRY') ||
        (action === 'CONFIRM' && current === 'CUSTOMER_CONFIRMED') ||
        (action === 'CONTEST' && current === 'CONTESTED')
      ) return tx.jobEscrow.findUniqueOrThrow({ where: { id: escrow.id } })

      if (action === 'REPORT') {
        if (reportDecision !== 'ACCEPT') {
          throw new Error(current === 'PROVIDER_REPORTED' ? 'CASH_COLLECTION_AWAITING_CUSTOMER' : 'CASH_COLLECTION_REPORT_MUST_INCREASE')
        }
        const claimed = await tx.jobEscrow.updateMany({
          where: {
            id: escrow.id,
            status: currentEscrow.status,
            cashCollectionStatus: current,
            cashCollectedMinor: currentEscrow.cashCollectedMinor,
          },
          data: {
            cashCollectedMinor: amountMinor!,
            cashCollectionStatus: 'PROVIDER_REPORTED',
            cashReportedAt: new Date(),
            cashReportedBy: actor.id,
          },
        })
        if (claimed.count !== 1) throw new Error('CASH_COLLECTION_STATE_CHANGED')
        await recordJobLifecycleEvent(tx, {
          jobId, actorId: actor.id, actorType: quote.providerType === 'COMPANY' ? 'COMPANY' : 'PROVIDER',
          action: 'CASH_COLLECTION_REPORTED', fromState: current, toState: 'PROVIDER_REPORTED',
          metadata: { escrowId: escrow.id, amountMinor: amountMinor!.toString(), currency: escrow.currency },
        })
      } else {
        if (current !== 'PROVIDER_REPORTED') throw new Error('CASH_COLLECTION_NOT_AWAITING_CUSTOMER')
        const next = action === 'CONFIRM' ? 'CUSTOMER_CONFIRMED' : 'CONTESTED'
        const claimed = await tx.jobEscrow.updateMany({
          where: { id: escrow.id, cashCollectionStatus: 'PROVIDER_REPORTED' },
          data: {
            cashCollectionStatus: next,
            ...(action === 'CONFIRM' ? { cashCollectionConfirmedAt: new Date() } : {}),
          },
        })
        if (claimed.count !== 1) throw new Error('CASH_COLLECTION_STATE_CHANGED')
        await recordJobLifecycleEvent(tx, {
          jobId, actorId: actor.id, actorType: 'CUSTOMER',
          action: action === 'CONFIRM' ? 'CASH_COLLECTION_CONFIRMED' : 'CASH_COLLECTION_CONTESTED',
          fromState: current, toState: next,
          metadata: { escrowId: escrow.id, amountMinor: (await tx.jobEscrow.findUnique({ where: { id: escrow.id }, select: { cashCollectedMinor: true } }))?.cashCollectedMinor?.toString() ?? null, currency: escrow.currency },
        })
      }

      return tx.jobEscrow.findUniqueOrThrow({ where: { id: escrow.id } })
    })

    const currency = escrow.currency as Currency
    return NextResponse.json({
      success: true,
      status: updated.cashCollectionStatus,
      amountMinor: updated.cashCollectedMinor?.toString() ?? null,
      amount: updated.cashCollectedMinor == null ? null : minorUnitsToMajorUnits(updated.cashCollectedMinor, currency),
      currency,
      commissionRecorded: false,
      message: action === 'REPORT'
        ? 'Cumulative cash received to date was reported. It is not treated as paid until you confirm it.'
        : action === 'CONFIRM'
          ? 'Cash amount confirmed. Commission is recorded only after work is accepted.'
          : 'Cash amount contested. No commission was recorded; raise a dispute if needed.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cash collection update failed'
    if (message.startsWith('CASH_COLLECTION_')) {
      return NextResponse.json({ error: message, code: message }, { status: 409 })
    }
    logger.error('Cash collection update failed unexpectedly', { err: error, route: '/api/mobile/v2/jobs/[id]/cash-collection', method: 'POST' })
    return NextResponse.json({ error: 'Cash collection update failed' }, { status: 500 })
  }
}
