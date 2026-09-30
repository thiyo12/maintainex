import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { transitionJobWorkspace, raiseJobDispute, cancelJob, type ActorType } from '@/lib/domain/job-lifecycle'
import { completeAndReleaseEscrow } from '@/lib/finance/escrow/escrow-service'
import { resolveProviderActor } from '@/lib/domain/job-actors'
import { notifyCompletionRequested, notifyJobCompleted, notifyPaymentReleased, notifyJobCancelled, notifyDisputeRaised } from '@/lib/notifications'
import { getCurrencyForCountry } from '@/lib/shared/money/money'

async function getAcceptedProviderRecipientIds(jobId: string): Promise<string[]> {
  const accepted = await prisma.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!accepted) return []

  if (accepted.providerType === 'INDIVIDUAL') {
    return [accepted.providerId]
  }

  const [company, assignments] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { id: accepted.providerId },
      select: { userId: true },
    }),
    prisma.companyJobAssignment.findMany({
      where: {
        jobId,
        companyId: accepted.providerId,
        workerUserId: { not: null },
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
      },
      select: { workerUserId: true },
    }),
  ])

  return [...new Set(
    [
      company?.userId ?? null,
      ...assignments.map(assignment => assignment.workerUserId),
    ].filter((value): value is string => Boolean(value))
  )]
}

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
      if (job.status !== 'IN_PROGRESS') {
        return NextResponse.json({ error: 'Dispute is only available after work has started' }, { status: 409 })
      }

      const reason =
        typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim().slice(0, 1000)
          : null
      const actorType: ActorType = isCustomer ? 'CUSTOMER' : providerActor!
      const disputeRecipientIds = isCustomer
        ? await getAcceptedProviderRecipientIds(job.id)
        : [job.customerId]

      await raiseJobDispute(
        { jobId: job.id, actorId: user.id, actorType, reason: reason || undefined },
        job.id
      )

      await Promise.all(
        disputeRecipientIds.map(recipientId =>
          notifyDisputeRaised(job.id, recipientId, job.title)
        )
      )

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

      const providerRecipientIds = isCustomer
        ? await getAcceptedProviderRecipientIds(job.id)
        : []

      await cancelJob({ jobId: job.id, actorId: user.id, actorType, reason: reason || undefined })

      if (isCustomer) {
        await Promise.all(
          providerRecipientIds.map(recipientId =>
            notifyJobCancelled(job.id, recipientId, job.title, 'customer', reason)
          )
        )
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
    if (
      message.includes('already released') ||
      message.includes('concurrently') ||
      message.includes('ESCROW_AUTHORIZED_AMOUNT_MISMATCH')
    ) {
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
    if (
      message.includes('Only the customer') ||
      message.includes('Only the accepted provider') ||
      message.includes('Only an authorized company manager') ||
      message.includes('Only the assigned worker') ||
      message.includes('assigned worker or an authorized company manager') ||
      message.includes('Actor is not a participant') ||
      message.includes('Unauthorized:') ||
      message.includes('not authorized')
    ) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
