import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id, status: 'PROTECTED' } })
    if (!escrow) return NextResponse.json({ error: 'No active escrow' }, { status: 400 })

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })
    if (!workspace || workspace.progressStatus !== 'COMPLETION_REQUESTED') {
      return NextResponse.json({ error: 'Completion must be requested first' }, { status: 400 })
    }

    if (job.customerId !== user.id) {
      return NextResponse.json({ error: 'Only the customer can approve and release' }, { status: 403 })
    }

    const providerWallet = await prisma.providerWallet.findUnique({
      where: { userId: escrow.providerId },
    })

    await prisma.$transaction([
      prisma.jobEscrow.update({
        where: { id: escrow.id },
        data: { status: 'RELEASED', releasedAt: new Date() },
      }),
      prisma.providerWallet.upsert({
        where: { userId: escrow.providerId },
        create: {
          userId: escrow.providerId,
          availableBalance: escrow.amount,
        },
        update: {
          availableBalance: { increment: escrow.amount },
        },
      }),
      prisma.walletTransaction.create({
        data: {
          userId: escrow.providerId,
          walletType: 'PROVIDER',
          type: 'CREDIT',
          amount: escrow.amount,
          balanceBefore: providerWallet?.availableBalance || 0,
          balanceAfter: (providerWallet?.availableBalance || 0) + escrow.amount,
          reference: `Payment for job ${job.title}`,
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

    return NextResponse.json({ success: true, message: 'Job completed, funds released' })
  } catch (error) {
    console.error('Complete job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
