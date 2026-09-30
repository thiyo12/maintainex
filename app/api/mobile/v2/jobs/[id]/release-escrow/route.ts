import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { completeAndReleaseEscrow } from '@/lib/finance/escrow/escrow-service'
import { notifyPaymentReleased, notifyCashJobCompleted, notifyJobCompleted } from '@/lib/notifications'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { auditEscrowRelease } from '@/lib/financial-audit'
import { getCurrencyForCountry } from '@/lib/shared/money/money'

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

    const rateLimitResponse = await requireFinancialRateLimit(request, 'release-escrow')
    if (rateLimitResponse) return rateLimitResponse

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) {
      return NextResponse.json({ error: 'Only the customer can approve completion' }, { status: 403 })
    }
    if (job.status === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        replayed: true,
        message: 'Job was already completed.',
      })
    }

    const paymentState = await prisma.jobEscrow.findFirst({
      where: { jobId: id, status: { in: ['PROTECTED', 'CASH_CONFIRMED'] } },
      select: { paymentMethod: true, status: true },
    })
    if (
      paymentState?.paymentMethod === 'CASH' &&
      paymentState.status === 'CASH_CONFIRMED'
    ) {
      const body = await request.json().catch(() => ({}))
      if (body.cashPaidConfirmed !== true) {
        return NextResponse.json(
          {
            error: 'Confirm that cash was paid to the provider before approving completion.',
            code: 'CASH_PAYMENT_CONFIRMATION_REQUIRED',
          },
          { status: 400 }
        )
      }
    }

    const result = await completeAndReleaseEscrow(
      { jobId: job.id, actorId: user.id, actorType: 'CUSTOMER' },
      job.id,
      { releaseMode: 'CUSTOMER_APPROVAL' }
    )

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    if (result.paymentMethod !== 'CASH') {
      auditEscrowRelease({
        jobId: job.id,
        escrowId: escrow?.id ?? job.id,
        actorId: user.id,
        amount: escrow?.totalAmount ?? escrow?.amount ?? 0n,
        commission: result.commission,
        netAmount: result.netAmount,
        currency: escrow?.currency ?? 'LKR',
      })
    }

    if (result.paymentMethod === 'CASH') {
      await notifyCashJobCompleted(
        job.id,
        result.providerId,
        job.title,
        result.platformDueCents,
        getCurrencyForCountry(job.countryCode),
      )
    } else {
      await notifyPaymentReleased(
        job.id,
        result.providerId,
        job.title,
        result.netAmount,
        getCurrencyForCountry(job.countryCode),
        job.countryCode,
      )
    }
    await notifyJobCompleted(job.id, job.customerId, job.title)

    return NextResponse.json({
      success: true,
      paymentMethod: result.paymentMethod,
      commission: result.commission,
      netAmount: result.netAmount,
      platformDue: result.platformDueCents,
      message:
        result.paymentMethod === 'CASH'
          ? 'Cash job completed and weekly platform amount recorded.'
          : 'Escrow released.',
    })
  } catch (error: any) {
    console.error('Release escrow error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('Only the customer')) return NextResponse.json({ error: message }, { status: 403 })
    if (message.includes('not found') || message.includes('No protected') || message.includes('No releasable')) return NextResponse.json({ error: message }, { status: 404 })
    if (
      message.includes('IDEMPOTENCY') ||
      message.includes('already') ||
      message.includes('state changed') ||
      message.includes('ESCROW_AUTHORIZED_AMOUNT_MISMATCH')
    ) return NextResponse.json({ error: message }, { status: 409 })
    if (message.includes('not in progress') || message.includes('Workspace not found')) return NextResponse.json({ error: message }, { status: 409 })
    if (message.includes('Provider must request completion first')) return NextResponse.json({ error: message }, { status: 400 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
