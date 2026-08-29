import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { notifyQuoteAccepted } from '@/lib/notifications'

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
    const { quoteId } = body
    if (!quoteId) return NextResponse.json({ error: 'quoteId required' }, { status: 400 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can select a quote' }, { status: 403 })
    if (job.status !== 'OPEN') return NextResponse.json({ error: 'Job is not open' }, { status: 400 })

    const quote = await prisma.jobQuote.findUnique({ where: { id: quoteId } })
    if (!quote || quote.jobId !== job.id) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    if (quote.status !== 'PENDING') return NextResponse.json({ error: 'Quote is not available' }, { status: 400 })

    const quotePrice = Number(quote.price)
    const serviceFeeCents = Math.round(quotePrice * 0.1 * 100) / 100
    const totalAmountCents = quotePrice + serviceFeeCents

    const existingEscrow = await prisma.jobEscrow.findFirst({
      where: { jobId: job.id, status: { in: ['CANCELLED', 'PENDING_PAYMENT'] } },
    })

    await prisma.$transaction(async (tx) => {
      await tx.jobQuote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } })
      await tx.jobQuote.updateMany({ where: { jobId: job.id, id: { not: quoteId } }, data: { status: 'REJECTED' } })
      await tx.marketplaceJob.update({ where: { id: job.id }, data: { status: 'QUOTE_ACCEPTED' } })
      await tx.jobWorkspace.upsert({
        where: { jobId: job.id },
        create: { jobId: job.id },
        update: { progressStatus: 'ACCEPTED' },
      })
      if (existingEscrow) {
        await tx.jobEscrow.update({
          where: { id: existingEscrow.id },
          data: {
            quoteId: quote.id,
            providerId: quote.providerId,
            amount: quote.price,
            serviceFee: BigInt(Math.round(serviceFeeCents)),
            totalAmount: BigInt(Math.round(totalAmountCents)),
            status: 'PENDING_PAYMENT',
            heldAt: null,
          },
        })
      } else {
        await tx.jobEscrow.create({
          data: {
            jobId: job.id,
            quoteId: quote.id,
            customerId: job.customerId,
            providerId: quote.providerId,
            amount: quote.price,
            serviceFee: BigInt(Math.round(serviceFeeCents)),
            totalAmount: BigInt(Math.round(totalAmountCents)),
            status: 'PENDING_PAYMENT',
          },
        })
      }
    })

    notifyQuoteAccepted(job.id, quote.providerId, job.title)

    return NextResponse.json({ success: true, quote: { ...quote, price: Number(quote.price) } })
  } catch (error) {
    console.error('Select quote error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
