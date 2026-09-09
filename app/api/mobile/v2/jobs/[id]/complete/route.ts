import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { transitionJobWorkspace, releaseEscrow, holdEscrowForDispute, type ActorType } from '@/lib/domain/job-lifecycle'
import { notifyCompletionRequested, notifyJobCompleted, notifyPaymentReleased } from '@/lib/notifications'

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
      const quote = await prisma.jobQuote.findFirst({
        where: { jobId: params.id, providerId: user.id },
      })
      if (!quote) return NextResponse.json({ error: 'Only the assigned provider can mark complete' }, { status: 403 })
      if (job.status !== 'IN_PROGRESS') {
        return NextResponse.json({ error: 'Job must be in progress' }, { status: 400 })
      }

      const isProvider = job.customerId !== user.id
      await transitionJobWorkspace(
        { jobId: params.id, actorId: user.id, actorType: isProvider ? 'PROVIDER' : 'CUSTOMER' },
        'COMPLETION_REQUESTED'
      )

      notifyCompletionRequested(job.id, job.customerId, job.title)
      return NextResponse.json({ success: true, message: 'Completion pending customer approval' })
    }

    if (action === 'APPROVE_COMPLETION') {
      if (job.customerId !== user.id) {
        return NextResponse.json({ error: 'Only the customer can approve' }, { status: 403 })
      }

      const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })
      if (!workspace || workspace.progressStatus !== 'COMPLETION_REQUESTED') {
        return NextResponse.json({ error: 'Provider must request completion first' }, { status: 400 })
      }

      const result = await releaseEscrow(
        { jobId: job.id, actorId: user.id, actorType: 'CUSTOMER' },
        job.id
      )

      await transitionJobWorkspace(
        { jobId: job.id, actorId: user.id, actorType: 'CUSTOMER' },
        'COMPLETED'
      )

      notifyPaymentReleased(job.id, job.customerId, job.title, result.netAmount)
      notifyJobCompleted(job.id, job.customerId, job.title)
      return NextResponse.json({ success: true, message: 'Job completed, funds released', commission: result.commission, netAmount: result.netAmount })
    }

    if (action === 'DISPUTE') {
      const isCustomer = job.customerId === user.id
      const isProvider = !isCustomer && !!(await prisma.jobQuote.findFirst({
        where: { jobId: job.id, providerId: user.id },
      }))
      if (!isCustomer && !isProvider) {
        return NextResponse.json({ error: 'You are not part of this job' }, { status: 403 })
      }
      if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Cannot dispute completed or cancelled jobs' }, { status: 400 })
      }

      const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
      if (escrow && escrow.status === 'PROTECTED') {
        await holdEscrowForDispute(
          { jobId: job.id, actorId: user.id, actorType: isCustomer ? 'CUSTOMER' : 'PROVIDER' },
          job.id
        )
      }

      await transitionJobWorkspace(
        { jobId: job.id, actorId: user.id, actorType: isCustomer ? 'CUSTOMER' : 'PROVIDER' },
        'DISPUTED'
      )

      return NextResponse.json({ success: true, message: 'Dispute raised' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Complete job error:', error)
    if (error.message?.includes('Cannot transition') || error.message?.includes('cannot transition')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
