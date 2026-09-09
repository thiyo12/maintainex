import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { refundEscrow } from '@/lib/domain/job-lifecycle'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) return NextResponse.json({ error: 'Only the customer can refund escrow' }, { status: 403 })

    const result = await refundEscrow(
      { jobId: params.id, actorId: user.id, actorType: 'CUSTOMER' },
      params.id
    )

    return NextResponse.json({ success: true, message: 'Escrow refunded', refundAmount: result.refundAmount })
  } catch (error) {
    console.error('Refund escrow error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
