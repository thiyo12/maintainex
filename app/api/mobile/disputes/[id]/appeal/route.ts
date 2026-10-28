import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { resolveMarketplaceDisputeParticipant } from '@/lib/domain/marketplace-dispute-participants'
import { appealMarketplaceDisputeInTransaction } from '@/lib/domain/marketplace-dispute-appeal'
import { secureConsole } from '@/lib/shared/observability/secure-console'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await authenticateRequest(request)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(actor)
    if (blocked) return blocked

    const { id: disputeId } = await params
    if (!disputeId || disputeId.length > 128) {
      return NextResponse.json({ error: 'Invalid dispute id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const appeal = typeof body?.appeal === 'string' ? body.appeal.trim() : ''
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
    if (appeal.length < 10 || appeal.length > 2000) {
      return NextResponse.json({ error: 'Appeal must be 10–2000 characters' }, { status: 400 })
    }
    if (!/^[A-Za-z0-9:_-]{16,128}$/.test(idempotencyKey)) {
      return NextResponse.json({ error: 'A valid idempotency key is required' }, { status: 400 })
    }

    const dispute = await prisma.marketplaceDispute.findUnique({
      where: { id: disputeId },
      select: { id: true, jobId: true, status: true, job: { select: { customerId: true } } },
    })
    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })

    if (!await resolveMarketplaceDisputeParticipant(prisma, dispute.jobId, actor.id)) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    const result = await prisma.$transaction(tx => appealMarketplaceDisputeInTransaction(tx, {
      disputeId,
      actorId: actor.id,
      appeal,
      idempotencyKey,
    }))

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' || result.code === 'NOT_PARTICIPANT' ? 404 : 409
      return NextResponse.json({
        error: result.code === 'NOT_RESOLVED'
          ? 'Only a resolved financial case can be appealed'
          : result.code === 'IDEMPOTENCY_CONFLICT'
            ? 'This case has already been reopened; refresh its status'
            : 'Dispute not found',
        code: result.code,
      }, { status })
    }

    return NextResponse.json({
      disputeId,
      status: result.status,
      replayed: result.replayed,
      financialEffect: 'NONE',
      message: 'Appeal recorded for review. No refund, payout, or balance change was made.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    secureConsole.error('Dispute appeal error:', error)
    return NextResponse.json({ error: 'Unable to submit appeal' }, { status: 500 })
  }
}
