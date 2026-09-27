import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { refundEscrow } from '@/lib/domain/job-lifecycle'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { auditEscrowRefund } from '@/lib/financial-audit'
import { notifyJobCancelled } from '@/lib/notifications'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const rateLimitResponse = await requireFinancialRateLimit(_request, 'escrow-refund')
    if (rateLimitResponse) return rateLimitResponse

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can refund escrow' }, { status: 403 })

    const accepted = await prisma.jobQuote.findFirst({
      where: { jobId: id, status: 'ACCEPTED' },
      select: { providerId: true, providerType: true },
    })
    const providerUserId = accepted
      ? accepted.providerType === 'INDIVIDUAL'
        ? accepted.providerId
        : (await prisma.companyProfile.findUnique({
            where: { id: accepted.providerId },
            select: { userId: true },
          }))?.userId ?? null
      : null

    const result = await refundEscrow(
      {
        jobId: id,
        actorId: user.id,
        actorType: 'CUSTOMER',
        reason: 'Customer requested escrow refund before work completion',
      },
      id
    )

    if (providerUserId) {
      await notifyJobCancelled(id, providerUserId, job.title, 'customer', 'Escrow refunded')
    }

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: id } })
    auditEscrowRefund({
      jobId: id,
      escrowId: escrow?.id ?? id,
      actorId: user.id,
      refundAmount: result.refundAmount,
      currency: escrow?.currency ?? 'LKR',
    })

    return NextResponse.json({ success: true, message: 'Escrow refunded', refundAmount: result.refundAmount })
  } catch (error: any) {
    console.error('Refund escrow error:', error)
    const message = error?.message || 'Failed to process refund'
    if (message.includes('Only the customer')) return NextResponse.json({ error: message }, { status: 403 })
    if (message.includes('ACTIVE_JOB_REQUIRES_DISPUTE')) {
      return NextResponse.json({ error: 'Work has started. Raise a dispute instead of using a direct refund.' }, { status: 409 })
    }
    if (message.includes('No refundable escrow') || message.includes('Job not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('already refunded') || message.includes('state changed')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
