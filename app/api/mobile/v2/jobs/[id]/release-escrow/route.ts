import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { releaseEscrow } from '@/lib/domain/job-lifecycle'
import { notifyPaymentReleased, notifyJobCompleted } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const escrow = await prisma.jobEscrow.findFirst({
      where: { jobId: job.id, status: 'PROTECTED' },
      select: { providerId: true },
    })
    if (!escrow) return NextResponse.json({ error: 'No protected escrow found' }, { status: 404 })

    const result = await releaseEscrow(
      { jobId: job.id, actorId: user.id, actorType: 'CUSTOMER' },
      job.id
    )

    notifyPaymentReleased(job.id, escrow.providerId, job.title, result.netAmount)
    notifyJobCompleted(job.id, job.customerId, job.title)

    return NextResponse.json({
      success: true,
      commission: result.commission,
      netAmount: result.netAmount,
    })
  } catch (error: any) {
    console.error('Release escrow error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('Only the customer')) return NextResponse.json({ error: message }, { status: 403 })
    if (message.includes('not found') || message.includes('No protected')) return NextResponse.json({ error: message }, { status: 404 })
    if (message.includes('IDEMPOTENCY') || message.includes('already')) return NextResponse.json({ error: message }, { status: 409 })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
