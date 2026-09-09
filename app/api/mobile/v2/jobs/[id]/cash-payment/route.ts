import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { releaseEscrow } from '@/lib/domain/job-lifecycle'

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

    const result = await releaseEscrow(
      { jobId: params.id, actorId: user.id, actorType: 'CUSTOMER' },
      params.id,
      { cashConfirmed: true }
    )

    return NextResponse.json({
      success: true,
      commission: result.commission,
      netAmount: result.netAmount,
    })
  } catch (error) {
    console.error('Cash payment error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
