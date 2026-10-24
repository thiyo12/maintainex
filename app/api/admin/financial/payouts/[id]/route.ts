import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmAction } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { consumeCrmStepUpFromHeader } from '@/lib/crm/governance/step-up'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import {
  markFailed,
  cancelPayout,
} from '@/lib/finance/payouts/payout-engine'

const VALID_ACTIONS = ['CONFIRM_EXTERNAL', 'FAILED', 'CANCELLED'] as const

function financialErrorStatus(code?: string) {
  if (code === 'NOT_FOUND') return 404
  if (code === 'INVALID_TRANSITION' || code === 'PAYOUTS_FROZEN') return 409
  return 400
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmAction(request, 'finance.payout')
    if (!guard.ok) return guard.response
    const security = guard.context

    const rateLimit = await requireFinancialRateLimit(request, 'payout-admin-action')
    if (rateLimit) return rateLimit

    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'payoutId required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action.trim().toUpperCase() : ''
    const reason = typeof body?.reason === 'string'
      ? body.reason.trim().slice(0, 2000)
      : ''

    if (!VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      )
    }

    if ((action === 'FAILED' || action === 'CANCELLED') && reason.length < 4) {
      return NextResponse.json(
        { error: 'A clear reason is required for FAILED/CANCELLED' },
        { status: 400 }
      )
    }

    const payout = await prisma.payout.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        amount: true,
        currency: true,
        countryCode: true,
        status: true,
        method: true,
        source: true,
      },
    })
    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, payout.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (action === 'CONFIRM_EXTERNAL') {
      return NextResponse.json(
        {
          error: 'A typed reference is not payout evidence. Wait for an independently verified bank or PSP result.',
          code: 'PAYOUT_EXTERNAL_EVIDENCE_REQUIRED',
          status: 'WAITING_BANK',
        },
        { status: 409 }
      )
    }

    const stepUp = await consumeCrmStepUpFromHeader({
      headerValue: request.headers.get('x-crm-step-up'),
      adminUserId: security.adminId,
      sessionId: security.sessionId,
      actionId: 'finance.payout',
    })
    if (!stepUp) {
      return NextResponse.json(
        { error: 'Step-up authentication required', code: 'STEP_UP_REQUIRED' },
        { status: 403 }
      )
    }

    const key = `crm-payout:${action.toLowerCase()}:${payout.id}`
    const result =
      action === 'FAILED'
        ? await markFailed(payout.id, reason, key, security.adminId)
        : await cancelPayout(payout.id, reason, key, security.adminId)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: financialErrorStatus(result.code) }
      )
    }

    await createAuditLog({
      action: 'UPDATE',
      category: 'FINANCE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'Payout',
      entityId: payout.id,
      entityName: payout.userId,
      description:
        action === 'FAILED'
          ? 'CRM payout failed and reserved funds restored'
          : 'CRM payout cancelled and reserved funds restored',
      oldValue: {
        status: payout.status,
      },
      newValue: {
        status: result.status,
        reason,
        amountMinor: payout.amount.toString(),
        currency: payout.currency,
        countryCode: payout.countryCode,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'HIGH',
    })

    const updated = await prisma.payout.findUnique({
      where: { id: payout.id },
      select: {
        id: true,
        userId: true,
        amount: true,
        status: true,
        source: true,
        method: true,
        currency: true,
        countryCode: true,
        rejectedReason: true,
        createdAt: true,
        clearedAt: true,
      },
    })

    return NextResponse.json({
      payout: updated
        ? {
            ...updated,
            amount: updated.amount.toString(),
          }
        : null,
      status: result.status,
    })
  } catch (error) {
    logger.error('CRM payout action failed unexpectedly', { err: error, route: '/api/admin/financial/payouts/[id]', method: 'PATCH' })
    return NextResponse.json({ error: 'Failed to process payout action' }, { status: 500 })
  }
}
