import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { notifyPaymentReleased, notifyJobCompleted } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can release escrow' }, { status: 403 })

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id, status: 'PROTECTED' } })
    if (!escrow) return NextResponse.json({ error: 'No protected escrow found' }, { status: 404 })

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
          reference: `Escrow release for job ${job.id}`,
          referenceType: 'ESCROW_RELEASE',
          referenceId: escrow.id,
        },
      }),
      prisma.marketplaceJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED' },
      }),
    ])

    notifyPaymentReleased(job.id, escrow.providerId, job.title, escrow.amount)
    notifyJobCompleted(job.id, job.customerId, job.title)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Release escrow error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
