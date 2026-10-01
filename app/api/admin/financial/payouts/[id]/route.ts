import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auth/authorization/admin-rbac'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import type { AdminSession } from '@/lib/admin-types'
import {
  markProcessing,
  markSucceeded,
  markFailed,
  cancelPayout,
} from '@/lib/finance/payouts/payout-engine'

const VALID_ACTIONS = ['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const

function sessionFromGuard(context: {
  adminId: string
  email: string
  role: AdminSession['role']
  assignedCountries: string[]
}): AdminSession {
  return {
    id: context.adminId,
    email: context.email,
    role: context.role,
    firstName: '',
    lastName: '',
    assignedCountries: context.assignedCountries,
    authType: 'adminUser',
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'wallets:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'payoutId required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action.toUpperCase() : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 2000) : undefined
    const providerRef = typeof body?.providerRef === 'string' ? body.providerRef.trim().slice(0, 500) : undefined

    if (!VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      )
    }
    if ((action === 'FAILED' || action === 'CANCELLED') && !reason) {
      return NextResponse.json({ error: 'Reason is required for FAILED/CANCELLED' }, { status: 400 })
    }

    const payout = await prisma.payout.findUnique({ where: { id } })
    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, payout.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const actorId = security.adminId
    const key = (next: string) => `admin-payout:${next}:${payout.id}`

    let result
    if (action === 'PROCESSING') {
      result = await markProcessing(payout.id, actorId, key('PROCESSING'))
    } else if (action === 'SUCCEEDED') {
      if (payout.status === 'RESERVED') {
        const step = await markProcessing(payout.id, actorId, key('PROCESSING'))
        if (!step.ok) {
          return NextResponse.json(
            { error: step.error, code: step.code },
            { status: step.code === 'INVALID_TRANSITION' ? 409 : 400 }
          )
        }
      }
      result = await markSucceeded(payout.id, providerRef ?? null, key('SUCCEEDED'), actorId)
    } else if (action === 'FAILED') {
      result = await markFailed(payout.id, reason!, key('FAILED'), actorId)
    } else {
      result = await cancelPayout(payout.id, reason!, key('CANCELLED'), actorId)
    }

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'INVALID_TRANSITION' ? 409 : 400
      return NextResponse.json({ error: result.error, code: result.code }, { status })
    }

    const updated = await prisma.payout.findUnique({ where: { id: payout.id } })
    const auditSession = sessionFromGuard(security)

    await createAuditLog({
      session: auditSession,
      action: action === 'FAILED' || action === 'CANCELLED' ? 'PAYOUT_REJECT' : 'PAYOUT_PROCESS',
      targetTable: 'Payout',
      targetId: payout.id,
      targetLabel: payout.method || undefined,
      oldValue: { status: payout.status },
      newValue: {
        status: result.status,
        ...(reason ? { reason } : {}),
        ...(providerRef ? { providerRef: '[PRESENT]' } : {}),
        processedBy: security.email,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent,
    })

    return NextResponse.json({
      payout: updated
        ? {
            ...updated,
            amount: updated.amount.toString(),
            bankDetails: updated.bankDetails ? '[REDACTED]' : null,
          }
        : null,
      status: result.status,
    })
  } catch (error) {
    console.error('CRM payout action error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
