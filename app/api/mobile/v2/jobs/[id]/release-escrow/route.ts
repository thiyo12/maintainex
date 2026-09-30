import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { completeAndReleaseEscrow } from '@/lib/finance/escrow/escrow-service'
import { notifyPaymentReleased, notifyJobCompleted } from '@/lib/notifications'
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

    const result = await completeAndReleaseEscrow(
      { jobId: job.id, actorId: user.id, actorType: 'CUSTOMER' },
      job.id,
      { releaseMode: 'CUSTOMER_APPROVAL' }
    )

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    auditEscrowRelease({
      jobId: job.id,
      escrowId: escrow?.id ?? job.id,
      actorId: user.id,
      amount: escrow?.totalAmount ?? escrow?.amount ?? 0n,
      commission: result.commission,
      netAmount: result.netAmount,
      currency: escrow?.currency ?? 'LKR',
    })

    await notifyPaymentReleased(
      job.id,
      result.providerId,
      job.title,
      result.netAmount,
      getCurrencyForCountry(job.countryCode),
      job.countryCode,
    )
    await notifyJobCompleted(job.id, job.customerId, job.title)

    return NextResponse.json({
      success: true,
      commission: result.commission,
      netAmount: result.netAmount,
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
