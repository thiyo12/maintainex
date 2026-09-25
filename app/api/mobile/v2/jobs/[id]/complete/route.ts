import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { transitionJobWorkspace, completeAndReleaseEscrow, raiseJobDispute, resolveProviderActor, cancelJob, type ActorType } from '@/lib/domain/job-lifecycle'
import { notifyCompletionRequested, notifyJobCompleted, notifyPaymentReleased, notifyJobCancelled, notifyDisputeRaised } from '@/lib/notifications'
import { getCurrencyForCountry } from '@/lib/money'

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

    const body = await request.json()
    const { action } = body

    if (!action || !['MARK_COMPLETE', 'APPROVE_COMPLETION', 'DISPUTE', 'CANCEL'].includes(action)) {
      return NextResponse.json({ error: 'action must be MARK_COMPLETE, APPROVE_COMPLETION, DISPUTE, or CANCEL' }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    if (action === 'MARK_COMPLETE') {
      if (job.status !== 'IN_PROGRESS') {
        return NextResponse.json({ error: 'Job must be in progress' }, { status: 400 })
      }

      const actorType = await resolveProviderActor(job.id, user.id)
      if (!actorType) return NextResponse.json({ error: 'Only the assigned provider can mark complete' }, { status: 403 })

      if (actorType === 'COMPANY') {
        const assignment = await prisma.companyJobAssignment.findFirst({
          where: {
            jobId: job.id,
            workerUserId: user.id,
            status: { in: ['ACCEPTED', 'IN_PROGRESS'] },
          },
          select: { id: true },
        })
        if (!assignment) {
          return NextResponse.json(
            { error: 'Only the employee assigned to this company job can mark work complete' },
            { status: 403 }
          )
        }
      }

      await transitionJobWorkspace(
        { jobId: job.id, actorId: user.id, actorType },
        'COMPLETION_REQUESTED'
      )

      await notifyCompletionRequested(job.id, job.customerId, job.title)
      return NextResponse.json({ success: true, message: 'Completion pending customer approval' })
    }

    if (action === 'APPROVE_COMPLETION') {
      const result = await completeAndReleaseEscrow(
        { jobId: job.id, actorId: user.id, actorType: 'CUSTOMER' },
        job.id
      )

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
      let disputeRecipientId: string | null = isCustomer ? null : job.customerId

      if (isCustomer) {
        const accepted = await prisma.jobQuote.findFirst({
          where: { jobId: job.id, status: 'ACCEPTED' },
          select: { providerId: true, providerType: true },
        })
        if (accepted) {
          disputeRecipientId =
            accepted.providerType === 'INDIVIDUAL'
              ? accepted.providerId
              : (await prisma.companyProfile.findUnique({
                  where: { id: accepted.providerId },
                  select: { userId: true },
                }))?.userId ?? null
        }
      }

      await raiseJobDispute(
        { jobId: job.id, actorId: user.id, actorType },
        job.id
      )

      if (disputeRecipientId) {
        await notifyDisputeRaised(job.id, disputeRecipientId, job.title)
      }

      return NextResponse.json({ success: true, message: 'Dispute raised' })
    }

    if (action === 'CANCEL') {
      const isCustomer = job.customerId === user.id
      const providerActor = isCustomer ? null : await resolveProviderActor(job.id, user.id)
      if (!isCustomer && !providerActor) {
        return NextResponse.json({ error: 'You are not part of this job' }, { status: 403 })
      }
      if (job.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Job is already cancelled' }, { status: 409 })
      }
      if (job.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Cannot cancel a completed job' }, { status: 409 })
      }
      if (job.status === 'IN_PROGRESS') {
        return NextResponse.json({ error: 'Cannot cancel after work has started' }, { status: 409 })
      }

      const reason =
        typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 300) : null
      const actorType: ActorType = isCustomer ? 'CUSTOMER' : providerActor!

      let providerUserId: string | null = null
      if (isCustomer) {
        const accepted = await prisma.jobQuote.findFirst({
          where: { jobId: job.id, status: 'ACCEPTED' },
          select: { providerId: true, providerType: true },
        })
        if (accepted) {
          providerUserId =
            accepted.providerType === 'INDIVIDUAL'
              ? accepted.providerId
              : (await prisma.companyProfile.findUnique({
                  where: { id: accepted.providerId },
                  select: { userId: true },
                }))?.userId ?? null
        }
      }

      await cancelJob({ jobId: job.id, actorId: user.id, actorType, reason: reason || undefined })

      if (isCustomer) {
        if (providerUserId) {
          await notifyJobCancelled(job.id, providerUserId, job.title, 'customer', reason)
        }
      } else {
        await notifyJobCancelled(job.id, job.customerId, job.title, 'provider', reason)
      }

      return NextResponse.json({ success: true, message: 'Job cancelled' })
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
    if (
      message.includes('not in progress') ||
      message.includes('No protected escrow') ||
      message.includes('No releasable') ||
      message.includes('Workspace not found') ||
      message.includes('Cannot dispute from workspace state') ||
      message.includes('cannot be cancelled in its current state')
    ) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('Only the customer')) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
