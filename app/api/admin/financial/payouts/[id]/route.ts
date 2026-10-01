import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmAction } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import {
  createCrmApprovalRequest,
} from '@/lib/crm/governance'
import { resolveCurrentApprovalRisk } from '@/lib/crm/governance/current-risk'
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
    const providerRef = typeof body?.providerRef === 'string'
      ? body.providerRef.trim().slice(0, 500)
      : ''
    const idempotencyKey = typeof body?.idempotencyKey === 'string'
      ? body.idempotencyKey.trim().slice(0, 200)
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

    if (action === 'CONFIRM_EXTERNAL') {
      if (providerRef.length < 4) {
        return NextResponse.json(
          { error: 'External transfer reference is required' },
          { status: 400 }
        )
      }
      if (idempotencyKey.length < 8) {
        return NextResponse.json(
          { error: 'A valid idempotencyKey is required' },
          { status: 400 }
        )
      }
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
      if (!['RESERVED', 'PROCESSING'].includes(payout.status)) {
        return NextResponse.json(
          { error: `Payout in status ${payout.status} cannot be externally confirmed` },
          { status: 409 }
        )
      }

      const currentRisk = await resolveCurrentApprovalRisk({
        actionId: 'finance.payout',
        market: payout.countryCode,
        targetType: 'Payout',
        targetId: payout.id,
        amountMinor: payout.amount,
        currency: payout.currency,
      })

      const approval = await createCrmApprovalRequest({
        actionId: 'finance.payout',
        initiatorAdminId: security.adminId,
        market: payout.countryCode,
        targetType: 'Payout',
        targetId: payout.id,
        amountMinor: payout.amount,
        currency: payout.currency,
        reasonCode: 'EXTERNAL_PAYOUT_CONFIRMATION',
        note: 'External payout confirmation submitted for governed approval',
        idempotencyKey,
        actionPayload: {
          mode: 'CONFIRM_EXTERNAL_PAYOUT',
          providerRef,
        },
        risk: currentRisk.risk,
      })

      return NextResponse.json(
        {
          mode: 'APPROVAL_REQUIRED',
          approval: {
            id: approval.request.id,
            status: approval.request.status,
            tier: approval.request.tier,
            expiresAt: approval.request.expiresAt,
            reused: approval.reused,
          },
        },
        { status: 202 }
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
    console.error('CRM payout action error:', error)
    return NextResponse.json({ error: 'Failed to process payout action' }, { status: 500 })
  }
}
