import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { notifyCompletionRequested, notifyJobCompleted, notifyPaymentReleased } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

      await prisma.jobWorkspace.updateMany({
        where: { jobId: job.id },
        data: { progressStatus: 'COMPLETION_REQUESTED' },
      })

      notifyCompletionRequested(job.id, job.customerId, job.title)
      return NextResponse.json({ success: true, message: 'Completion pending customer approval' })
    }

    if (action === 'APPROVE_COMPLETION') {
      if (job.customerId !== user.id) {
        return NextResponse.json({ error: 'Only the customer can approve' }, { status: 403 })
      }

      const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id, status: 'PROTECTED' } })
      if (!escrow) return NextResponse.json({ error: 'No active escrow' }, { status: 400 })

      const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })
      if (!workspace || workspace.progressStatus !== 'COMPLETION_REQUESTED') {
        return NextResponse.json({ error: 'Provider must request completion first' }, { status: 400 })
      }

      const company = await prisma.companyProfile.findUnique({
        where: { userId: escrow.providerId },
        select: { commissionRate: true },
      })
      const commissionRate = company?.commissionRate ?? 0
      const commission = commissionRate > 0 ? Math.round(escrow.amount * (commissionRate / 100) * 100) / 100 : 0
      const netAmount = escrow.amount - commission

      const providerWallet = await prisma.providerWallet.findUnique({
        where: { userId: escrow.providerId },
      })
      const currentBalance = providerWallet?.availableBalance || 0

      await prisma.$transaction([
        prisma.jobEscrow.update({
          where: { id: escrow.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        }),
        prisma.providerWallet.upsert({
          where: { userId: escrow.providerId },
          create: { userId: escrow.providerId, availableBalance: netAmount },
          update: { availableBalance: { increment: netAmount } },
        }),
        prisma.walletTransaction.create({
          data: {
            userId: escrow.providerId,
            walletType: 'PROVIDER',
            type: 'CREDIT',
            amount: netAmount,
            balanceBefore: currentBalance,
            balanceAfter: currentBalance + netAmount,
            reference: commission > 0
              ? `Payment for job ${job.title} (${commissionRate}% commission: LKR ${commission})`
              : `Payment for job ${job.title}`,
            referenceType: 'ESCROW_RELEASE',
            referenceId: escrow.id,
          },
        }),
        prisma.marketplaceJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED' },
        }),
        prisma.jobWorkspace.update({
          where: { jobId: job.id },
          data: { progressStatus: 'COMPLETED' },
        }),
      ])

      notifyPaymentReleased(job.id, escrow.providerId, job.title, netAmount)
      notifyJobCompleted(job.id, job.customerId, job.title)
      return NextResponse.json({ success: true, message: 'Job completed, funds released', commission, netAmount })
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
        await prisma.jobEscrow.update({
          where: { id: escrow.id },
          data: { status: 'ON_HOLD' },
        })
      }

      await prisma.marketplaceJob.update({
        where: { id: job.id },
        data: { status: 'CANCELLED' },
      })
      await prisma.jobWorkspace.updateMany({
        where: { jobId: job.id },
        data: { progressStatus: 'DISPUTED' },
      })

      return NextResponse.json({ success: true, message: 'Dispute raised' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Complete job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
