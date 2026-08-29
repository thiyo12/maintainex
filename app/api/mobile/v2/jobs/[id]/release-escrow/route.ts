import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { notifyPaymentReleased, notifyJobCompleted } from '@/lib/notifications'

async function getProviderCommissionRate(providerId: string): Promise<number> {
  const company = await prisma.companyProfile.findUnique({
    where: { userId: providerId },
    select: { commissionRate: true },
  })
  return company?.commissionRate ?? 0
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

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can release escrow' }, { status: 403 })

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id, status: 'PROTECTED' } })
    if (!escrow) return NextResponse.json({ error: 'No protected escrow found' }, { status: 404 })

    const escrowAmount = Number(escrow.amount)
    const commissionRate = await getProviderCommissionRate(escrow.providerId)
    const commission = commissionRate > 0 ? Math.round(escrowAmount * (commissionRate / 100) * 100) / 100 : 0
    const netAmount = escrowAmount - commission

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
        create: {
          userId: escrow.providerId,
          availableBalance: netAmount,
        },
        update: {
          availableBalance: { increment: netAmount },
        },
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
            ? `Escrow release for job ${job.id} (${commissionRate}% commission: LKR ${commission})`
            : `Escrow release for job ${job.id}`,
          referenceType: 'ESCROW_RELEASE',
          referenceId: escrow.id,
        },
      }),
      prisma.marketplaceJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED' },
      }),
    ])

    notifyPaymentReleased(job.id, escrow.providerId, job.title, netAmount)
    notifyJobCompleted(job.id, job.customerId, job.title)
    return NextResponse.json({ success: true, commission, netAmount })
  } catch (error) {
    console.error('Release escrow error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
