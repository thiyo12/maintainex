import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { transitionJobWorkspace, completeAndReleaseEscrow, holdEscrowForDispute, type ActorType } from '@/lib/domain/job-lifecycle'
import { notifyCompletionRequested, notifyJobCompleted, notifyPaymentReleased } from '@/lib/notifications'

async function resolveProviderActor(jobId: string, userId: string): Promise<ActorType | null> {
  const acceptedQuote = await prisma.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!acceptedQuote) return null

  if (acceptedQuote.providerType === 'INDIVIDUAL' && acceptedQuote.providerId === userId) {
    return 'PROVIDER'
  }

  if (acceptedQuote.providerType === 'COMPANY') {
    const membership = await prisma.teamMember.findFirst({
      where: { companyId: acceptedQuote.providerId, userId, status: 'ACTIVE' },
      select: { id: true },
    })
    if (membership) return 'COMPANY'
  }

  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { action } = body

    if (!action || !['MARK_COMPLETE', 'APPROVE_COMPLETION', 'DISPUTE'].includes(action)) {
      return NextResponse.json({ error: 'action must be MARK_COMPLETE, APPROVE_COMPLETION, or DISPUTE' }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    if (action === 'MARK_COMPLETE') {
      if (job.status !== 'IN_PROGRESS') {
        return NextResponse.json({ error: 'Job must be in progress' }, { status: 400 })
      }

      const actorType = await resolveProviderActor(job.id, user.id)
      if (!actorType) return NextResponse.json({ error: 'Only the assigned provider can mark complete' }, { status: 403 })

      await transitionJobWorkspace(
        { jobId: job.id, actorId: user.id, actorType },
        'COMPLETION_REQUESTED'
      )

      notifyCompletionRequested(job.id, job.customerId, job.title)
      return NextResponse.json({ success: true, message: 'Completion pending customer approval' })
    }

    if (action === 'APPROVE_COMPLETION') {
      const result = await completeAndReleaseEscrow(
        { jobId: job.id, actorId: user.id, actorType: 'CUSTOMER' },
        job.id
      )

      notifyPaymentReleased(job.id, result.providerId, job.title, result.netAmount)
      notifyJobCompleted(job.id, job.customerId, job.title)
      return NextResponse.json({
        success: true,
        message: 'Job completed, funds released',
        commission: result.commission,
        netAmount: result.netAmount,
      })
    }

    if (action === 'DISPUTE') {
      const isCustomer = job.customerId === user.id
      const providerActor = isCustomer ? null : await resolveProviderActor(job.id, user.id)
      if (!isCustomer && !providerActor) {
        return NextResponse.json({ error: 'You are not part of this job' }, { status: 403 })
      }
      if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Cannot dispute completed or cancelled jobs' }, { status: 400 })
      }

      const actorType: ActorType = isCustomer ? 'CUSTOMER' : providerActor!
      const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
      if (escrow?.status === 'PROTECTED') {
        await holdEscrowForDispute(
          { jobId: job.id, actorId: user.id, actorType },
          job.id
        )
      }

      await transitionJobWorkspace(
        { jobId: job.id, actorId: user.id, actorType },
        'DISPUTED'
      )

      return NextResponse.json({ success: true, message: 'Dispute raised' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Complete job error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('Cannot transition') || message.includes('cannot transition') || message.includes('Actor type')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('already released') || message.includes('concurrently')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
