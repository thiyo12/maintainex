import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { fundEscrow } from '@/lib/domain/job-lifecycle'
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

    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: job.id, status: 'ACCEPTED' },
      select: { providerId: true },
    })

    await fundEscrow(
      { jobId: job.id, actorId: user.id, actorType: 'CUSTOMER' },
      job.id
    )

    if (quote) notifyEscrowDeposited(job.id, quote.providerId, job.title)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    console.error('Escrow error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('Only the customer')) return NextResponse.json({ error: message }, { status: 403 })
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    if (message.includes('already active')) return NextResponse.json({ error: message }, { status: 409 })
    if (message.includes('Insufficient') || message.includes('not ready') || message.includes('accepted quote')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isParticipant = job.customerId === user.id ||
      !!(await prisma.jobQuote.findFirst({ where: { jobId: params.id, providerId: user.id, status: 'ACCEPTED' } }))
    if (!isParticipant) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: params.id } })
    return NextResponse.json({
      escrow: escrow ? {
        ...escrow,
        amount: escrow.amount.toString(),
        serviceFee: escrow.serviceFee.toString(),
        totalAmount: escrow.totalAmount.toString(),
      } : null,
    })
  } catch (error) {
    console.error('Get escrow error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
