import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can refund escrow' }, { status: 403 })

    const escrow = await prisma.jobEscrow.findFirst({
      where: { jobId: job.id, status: 'PROTECTED' },
    })
    if (!escrow) return NextResponse.json({ error: 'No protected escrow found' }, { status: 404 })

    const wallet = await prisma.customerWallet.findUnique({ where: { userId: user.id } })
    const balanceBefore = wallet?.balance || 0
    const newBalance = balanceBefore + escrow.totalAmount

    await prisma.$transaction([
      prisma.jobEscrow.update({
        where: { id: escrow.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      }),
      prisma.customerWallet.update({
        where: { userId: user.id },
        data: { balance: newBalance },
      }),
      prisma.walletTransaction.create({
        data: {
          userId: user.id,
          walletType: 'CUSTOMER',
          type: 'CREDIT',
          amount: escrow.totalAmount,
          balanceBefore,
          balanceAfter: newBalance,
          reference: `Escrow refund for job ${job.title}`,
          referenceType: 'ESCROW_REFUND',
          referenceId: escrow.id,
        },
      }),
      prisma.marketplaceJob.update({
        where: { id: job.id },
        data: { status: 'CANCELLED' },
      }),
      prisma.jobQuote.update({
        where: { id: escrow.quoteId },
        data: { status: 'WITHDRAWN' },
      }),
    ])

    return NextResponse.json({ success: true, message: 'Escrow refunded' })
  } catch (error) {
    console.error('Refund escrow error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
