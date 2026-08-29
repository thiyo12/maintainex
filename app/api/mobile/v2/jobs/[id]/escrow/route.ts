import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { notifyEscrowDeposited } from '@/lib/notifications'

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
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can deposit escrow' }, { status: 403 })
    if (job.status !== 'IN_PROGRESS') return NextResponse.json({ error: 'Job must be in progress' }, { status: 400 })

    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: job.id, status: 'ACCEPTED' },
    })
    if (!quote) return NextResponse.json({ error: 'No accepted quote found' }, { status: 400 })

    const existingEscrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    if (existingEscrow) return NextResponse.json({ error: 'Escrow already exists' }, { status: 409 })

    const wallet = await prisma.customerWallet.findUnique({ where: { userId: user.id } })
    const quotePrice = Number(quote.price)
    if (!wallet || wallet.balance < quotePrice) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    const serviceFeeCents = Math.round(quotePrice * 0.1 * 100) / 100
    const totalAmountCents = quotePrice + serviceFeeCents

    await prisma.$transaction(async (tx) => {
      await tx.customerWallet.update({
        where: { userId: user.id },
        data: { balance: { decrement: totalAmountCents } },
      })
      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          walletType: 'CUSTOMER',
          type: 'DEBIT',
          amount: totalAmountCents,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance - totalAmountCents,
          reference: `Escrow deposit for job ${job.id}`,
          referenceType: 'ESCROW_RELEASE',
          referenceId: params.id,
        },
      })
      await tx.jobEscrow.create({
        data: {
          jobId: job.id,
          quoteId: quote.id,
          customerId: user.id,
          providerId: quote.providerId,
          amount: quote.price,
          serviceFee: BigInt(Math.round(serviceFeeCents)),
          totalAmount: BigInt(Math.round(totalAmountCents)),
          status: 'PROTECTED',
          heldAt: new Date(),
        },
      })
    })

    notifyEscrowDeposited(job.id, quote.providerId, job.title)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Escrow error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isParticipant = job.customerId === user.id ||
      !!(await prisma.jobQuote.findFirst({ where: { jobId: params.id, providerId: user.id } }))
    if (!isParticipant) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: params.id } })
    return NextResponse.json({ escrow: escrow ? { ...escrow, amount: Number(escrow.amount), serviceFee: Number(escrow.serviceFee), totalAmount: Number(escrow.totalAmount) } : null })
  } catch (error) {
    console.error('Get escrow error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
