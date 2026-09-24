import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { refundEscrow, resolveProviderActor, type ActorType } from '@/lib/domain/job-lifecycle'
import { notifyJobCancelled } from '@/lib/notifications'

function sanitizeReason(value: unknown): string {
  if (typeof value !== 'string') return 'No reason provided'
  const trimmed = value.trim().replace(/[\u0000-\u001F\u007F]/g, '')
  return trimmed.slice(0, 500) || 'No reason provided'
}

async function providerRecipientUserId(quote: { providerId: string; providerType: string }): Promise<string | null> {
  if (quote.providerType === 'INDIVIDUAL') return quote.providerId
  const company = await prisma.companyProfile.findUnique({
    where: { id: quote.providerId },
    select: { userId: true },
  })
  return company?.userId ?? null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json().catch(() => ({}))
    const reason = sanitizeReason(body?.reason)

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    if (job.status === 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Work has already started. Use the dispute flow instead of normal cancellation.' },
        { status: 409 }
      )
    }
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return NextResponse.json({ error: `Job is already ${job.status.toLowerCase()}` }, { status: 409 })
    }

    let actorType: ActorType
    const isCustomer = job.customerId === user.id

    if (isCustomer) {
      actorType = 'CUSTOMER'
    } else {
      const resolved = await resolveProviderActor(jobId, user.id)
      if (!resolved || (resolved !== 'PROVIDER' && resolved !== 'COMPANY')) {
        return NextResponse.json({ error: 'Only the customer or accepted provider can cancel this job' }, { status: 403 })
      }
      actorType = resolved
    }

    // A provider is only authorized after its quote has been accepted.
    if (!isCustomer && job.status !== 'QUOTE_ACCEPTED') {
      return NextResponse.json({ error: 'Provider cannot cancel a job before quote acceptance' }, { status: 403 })
    }

    const quotes = await prisma.jobQuote.findMany({
      where: { jobId },
      select: { id: true, providerId: true, providerType: true, status: true },
    })
    const acceptedQuote = quotes.find(quote => quote.status === 'ACCEPTED') ?? null
    const escrow = await prisma.jobEscrow.findFirst({
      where: { jobId, status: { in: ['PENDING_PAYMENT', 'PROTECTED', 'ON_HOLD'] } },
      select: { id: true },
    })

    let refunded = false
    if (job.status === 'QUOTE_ACCEPTED' && escrow) {
      await refundEscrow({ jobId, actorId: user.id, actorType, reason }, jobId)
      refunded = true

      await prisma.$transaction([
        prisma.marketplaceJob.updateMany({
          where: { id: jobId, status: 'CANCELLED' },
          data: { isActive: false, responseState: 'resolved' },
        }),
        prisma.companyJobAssignment.updateMany({
          where: { jobId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
          data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: `Job cancelled: ${reason}` },
        }),
      ])
    } else {
      const expectedStatus = job.status
      await prisma.$transaction(async tx => {
        const claimed = await tx.marketplaceJob.updateMany({
          where: { id: jobId, status: expectedStatus },
          data: { status: 'CANCELLED', isActive: false, responseState: 'resolved' },
        })
        if (claimed.count !== 1) throw new Error('JOB_STATE_CHANGED')

        if (expectedStatus === 'OPEN') {
          await tx.jobQuote.updateMany({
            where: { jobId, status: 'PENDING' },
            data: { status: 'REJECTED' },
          })
        } else {
          await tx.jobQuote.updateMany({
            where: { jobId, status: 'ACCEPTED' },
            data: { status: 'WITHDRAWN' },
          })
        }

        await tx.companyJobAssignment.updateMany({
          where: { jobId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
          data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: `Job cancelled: ${reason}` },
        })
      })
    }

    await prisma.marketplaceRiskEvent.create({
      data: {
        jobId,
        actorUserId: user.id,
        eventType: 'JOB_CANCELLED',
        severity: 'LOW',
        metadata: JSON.stringify({
          actorType,
          reason,
          previousStatus: job.status,
          refunded,
        }),
      },
    }).catch(error => console.error('Cancellation audit event failed:', error))

    const recipientIds = new Set<string>()
    if (isCustomer) {
      for (const quote of quotes.filter(q => q.status === 'PENDING' || q.status === 'ACCEPTED')) {
        const recipientId = await providerRecipientUserId(quote)
        if (recipientId && recipientId !== user.id) recipientIds.add(recipientId)
      }
    } else {
      recipientIds.add(job.customerId)
    }

    await Promise.all(
      [...recipientIds].map(recipientId =>
        notifyJobCancelled(jobId, recipientId, job.title, isCustomer ? 'CUSTOMER' : 'PROVIDER')
      )
    )

    return NextResponse.json({
      success: true,
      jobId,
      status: 'CANCELLED',
      refunded,
      cancelledBy: isCustomer ? 'CUSTOMER' : actorType,
    })
  } catch (error: any) {
    console.error('Cancel job error:', error)
    const message = error?.message || 'Failed to cancel job'
    if (message === 'JOB_STATE_CHANGED' || message.includes('state changed') || message.includes('already refunded')) {
      return NextResponse.json({ error: 'Job changed while cancellation was being processed. Refresh and try again.' }, { status: 409 })
    }
    if (message === 'ACTIVE_JOB_REQUIRES_DISPUTE') {
      return NextResponse.json({ error: 'Active jobs must use the dispute flow' }, { status: 409 })
    }
    if (message.includes('Only the customer') || message.includes('accepted provider')) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 })
  }
}
