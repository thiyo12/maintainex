import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
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
    const guard = await guardCrmRequest(request, {
      permission: 'commission:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

    let scopedJobIds: string[] | null = null
    if (!security.isSuperAdmin) {
      scopedJobIds = (await prisma.marketplaceJob.findMany({
        where: getCrmCountryFilter(security),
        select: { id: true },
      })).map(job => job.id)
    }

    const where: any = {}
    if (scopedJobIds) where.jobId = { in: scopedJobIds }
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

    return NextResponse.json(
      { escrows: escrows.map(serializeEscrow), total, page, limit },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('Admin escrows error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'commission:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const rateLimitResponse = await requireFinancialRateLimit(request, 'admin-escrow')
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json().catch(() => ({}))
    const escrowId = typeof body.escrowId === 'string' ? body.escrowId.trim() : ''
    const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : ''
    if (!escrowId || !['RELEASE', 'REFUND'].includes(action)) {
      return NextResponse.json({ error: 'escrowId and action RELEASE or REFUND required' }, { status: 400 })
    }

    const escrow = await prisma.jobEscrow.findUnique({ where: { id: escrowId } })
    if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: escrow.jobId },
      select: { countryCode: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, job.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (escrow.status !== 'ON_HOLD') {
      return NextResponse.json({ error: 'Escrow must be ON_HOLD for an admin resolution' }, { status: 409 })
    }

    if (action === 'RELEASE') {
      const result = await releaseEscrow(
        { jobId: escrow.jobId, actorId: security.adminId, actorType: 'STAFF', reason: 'Admin force-release' },
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
      { jobId: escrow.jobId, actorId: security.adminId, actorType: 'STAFF', reason: 'Admin refund' },
      escrow.jobId,
    )
    const pendingExternal = result.refundPendingExternal === true
    return NextResponse.json(
      {
        success: true,
        message: pendingExternal
          ? 'External PayHere refund queued for reconciliation'
          : 'Escrow refunded by admin through canonical ledger',
        refundAmount: result.refundAmount,
        refundStatus: pendingExternal ? 'REFUND_REQUIRED' : 'REFUNDED',
        fundingSource: result.fundingSource,
      },
      { status: pendingExternal ? 202 : 200 }
    )
  } catch (error) {
    secureConsole.error('Admin escrow action error:', error)
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
