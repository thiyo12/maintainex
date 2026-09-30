import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { auditCommissionSettlement } from '@/lib/financial-audit'

function serializeSettlement<T extends { jobAmount: bigint; commissionAmount: bigint }>(settlement: T) {
  return {
    ...settlement,
    jobAmount: settlement.jobAmount.toString(),
    commissionAmount: settlement.commissionAmount.toString(),
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
    const where: any = { ...getCrmCountryFilter(security) }
    if (status) where.status = status

    const settlements = await prisma.commissionSettlement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json(
      { settlements: settlements.map(serializeSettlement) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('List commission settlements error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * Commission is withheld and credited to the platform inside the canonical
 * escrow release transaction. This endpoint is reconciliation-only: it marks
 * the already-withheld settlement as SETTLED and must never debit a provider
 * wallet or post another commission ledger movement.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'commission:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const rateLimitResponse = await requireFinancialRateLimit(request, 'commission-settle')
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json().catch(() => ({}))
    const settlementId = typeof body.settlementId === 'string' ? body.settlementId.trim() : ''
    if (!settlementId) {
      return NextResponse.json({ error: 'settlementId required' }, { status: 400 })
    }

    const settlement = await prisma.commissionSettlement.findUnique({ where: { id: settlementId } })
    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, settlement.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (settlement.status !== 'PENDING') {
      return NextResponse.json({ error: 'Settlement already processed' }, { status: 409 })
    }

    const claimed = await prisma.commissionSettlement.updateMany({
      where: { id: settlementId, status: 'PENDING' },
      data: { status: 'SETTLED', settledAt: new Date() },
    })
    if (claimed.count !== 1) {
      return NextResponse.json({ error: 'Settlement was processed concurrently' }, { status: 409 })
    }

    const updated = await prisma.commissionSettlement.findUniqueOrThrow({ where: { id: settlementId } })

    auditCommissionSettlement({
      settlementId: updated.id,
      actorId: security.adminId,
      amount: updated.commissionAmount,
      currency: updated.currency,
    })

    return NextResponse.json({ settlement: serializeSettlement(updated) })
  } catch (error) {
    console.error('Settle commission error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
