import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { releaseEscrow, refundEscrow } from '@/lib/finance/escrow/escrow-service'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'

function serializeEscrow<T extends { amount: bigint; serviceFee: bigint; totalAmount: bigint }>(escrow: T) {
  return {
    ...escrow,
    amount: escrow.amount.toString(),
    serviceFee: escrow.serviceFee.toString(),
    totalAmount: escrow.totalAmount.toString(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || !['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const where: { status?: string } = {}
    if (status) where.status = status

    const [escrows, total] = await Promise.all([
      prisma.jobEscrow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.jobEscrow.count({ where }),
    ])

    return NextResponse.json({ escrows: escrows.map(serializeEscrow), total, page, limit })
  } catch (error) {
    console.error('Admin escrows error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || !['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResponse = await requireFinancialRateLimit(request, 'admin-escrow')
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const escrowId = typeof body.escrowId === 'string' ? body.escrowId.trim() : ''
    const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : ''
    if (!escrowId || !['RELEASE', 'REFUND'].includes(action)) {
      return NextResponse.json({ error: 'escrowId and action RELEASE or REFUND required' }, { status: 400 })
    }

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: escrowId } })
    if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    if (escrow.status !== 'ON_HOLD') {
      return NextResponse.json({ error: 'Escrow must be ON_HOLD for an admin resolution' }, { status: 400 })
    }

    if (action === 'RELEASE') {
      const result = await releaseEscrow(
        { jobId: escrow.jobId, actorId: user.id, actorType: 'STAFF', reason: 'Admin force-release' },
        escrow.jobId,
      )
      return NextResponse.json({
        success: true,
        message: 'Escrow released by admin through canonical ledger',
        netAmount: result.netAmount,
        commission: result.commission,
      })
    }

    const result = await refundEscrow(
      { jobId: escrow.jobId, actorId: user.id, actorType: 'STAFF', reason: 'Admin refund' },
      escrow.jobId,
    )
    return NextResponse.json({
      success: true,
      message: 'Escrow refunded by admin through canonical ledger',
      refundAmount: result.refundAmount,
    })
  } catch (error) {
    console.error('Admin escrow action error:', error)
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already') || message.includes('concurrently') || message.includes('state changed')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message === 'CASH_PAYMENT_DISABLED') {
      return NextResponse.json({ error: 'Cash settlement is disabled until a funded cash accounting flow is implemented' }, { status: 503 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
