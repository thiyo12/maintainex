import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

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
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can confirm cash payment' }, { status: 403 })

    if (job.status !== 'IN_PROGRESS') return NextResponse.json({ error: 'Job must be in progress' }, { status: 400 })

    const escrow = await prisma.jobEscrow.findFirst({
      where: { jobId: job.id, paymentMethod: 'CASH' },
    })
    if (!escrow) return NextResponse.json({ error: 'No cash escrow found for this job' }, { status: 404 })
    if (escrow.status !== 'PROTECTED') return NextResponse.json({ error: 'Escrow is not in protected status' }, { status: 400 })

    const providerWallet = await prisma.providerWallet.findUnique({
      where: { userId: escrow.providerId },
    })
    const currentBalance = providerWallet?.availableBalance || 0

    const escrowAmount = Number(escrow.amount)
    const commissionRate = Number(escrow.serviceFee)
    const commission = commissionRate > 0 ? Math.round(escrowAmount * (commissionRate / 100) * 100) / 100 : 0
    const netAmount = escrowAmount - commission

    const updated = await prisma.$transaction([
      prisma.jobEscrow.update({
        where: { id: escrow.id },
        data: { status: 'RELEASED', releasedAt: new Date(), cashConfirmedAt: new Date() },
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
            ? `Cash payment for job ${job.id} (${commissionRate}% commission: LKR ${commission})`
            : `Cash payment for job ${job.id}`,
          referenceType: 'ESCROW_RELEASE',
          referenceId: escrow.id,
        },
      }),
      prisma.marketplaceJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED' },
      }),
      prisma.commissionSettlement.create({
        data: {
          jobId: job.id,
          escrowId: escrow.id,
          providerId: escrow.providerId,
          customerId: escrow.customerId,
          jobAmount: escrow.amount,
          commissionRate,
          commissionAmount: BigInt(Math.round(commission)),
          status: 'PENDING',
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      commission,
      netAmount,
      settlementId: updated[4].id,
    })
  } catch (error) {
    console.error('Cash payment error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
