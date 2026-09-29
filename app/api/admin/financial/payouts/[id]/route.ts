import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { createAuditLog, getCountryFilter, getIp } from '@/lib/auth/authorization/admin-rbac'
import {
  markProcessing,
  markSucceeded,
  markFailed,
  cancelPayout,
} from '@/lib/finance/payouts/payout-engine'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']
const VALID_ACTIONS = ['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const

function getAdminId(session: unknown): string {
  const s = session as { id?: string; sub?: string }
  return s.id || s.sub || ''
}

// PATCH: Admin payout approval/rejection workflow.
// PROCESSING — provider payout initiated (bank transfer sent)
// SUCCEEDED  — payout settled externally (auto-passes through PROCESSING if needed)
// FAILED     — payout rejected, reserved funds restored to provider wallet (reason required)
// CANCELLED  — payout cancelled by admin, reserved funds restored (reason required)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'payoutId required' }, { status: 400 })
    }

    const body = await request.json()
    const { action, reason, providerRef } = body as {
      action?: string
      reason?: string
      providerRef?: string
    }

    if (!action || !VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      )
    }
    if ((action === 'FAILED' || action === 'CANCELLED') && !reason?.trim()) {
      return NextResponse.json({ error: 'Reason is required for FAILED/CANCELLED' }, { status: 400 })
    }

    const payout = await prisma.payout.findUnique({ where: { id } })
    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      const countryFilter = getCountryFilter(session as never)
      if (countryFilter.id === '__NONE__') {
        return NextResponse.json({ error: 'No country assigned' }, { status: 403 })
      }
      if (
        countryFilter.countryCode &&
        !countryFilter.countryCode.in?.includes(payout.countryCode || 'LK')
      ) {
        return NextResponse.json({ error: 'Forbidden: payout belongs to a different country' }, { status: 403 })
      }
    }

    const actorId = getAdminId(session)
    const key = (a: string) => `admin-payout:${a}:${payout.id}`

    let result
    if (action === 'PROCESSING') {
      result = await markProcessing(payout.id, actorId, key('PROCESSING'))
    } else if (action === 'SUCCEEDED') {
      // Allow one-click approve: RESERVED → PROCESSING → SUCCEEDED.
      if (payout.status === 'RESERVED') {
        const step = await markProcessing(payout.id, actorId, key('PROCESSING'))
        if (!step.ok) {
          return NextResponse.json({ error: step.error, code: step.code }, { status: step.code === 'INVALID_TRANSITION' ? 409 : 400 })
        }
      }
      result = await markSucceeded(payout.id, providerRef ?? null, key('SUCCEEDED'), actorId)
    } else if (action === 'FAILED') {
      result = await markFailed(payout.id, reason!.trim(), key('FAILED'), actorId)
    } else {
      result = await cancelPayout(payout.id, reason!.trim(), key('CANCELLED'), actorId)
    }

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'INVALID_TRANSITION' ? 409 : 400
      return NextResponse.json({ error: result.error, code: result.code }, { status })
    }

    const updated = await prisma.payout.findUnique({ where: { id: payout.id } })

    await createAuditLog({
      session: { ...session, id: actorId } as never,
      action: action === 'FAILED' || action === 'CANCELLED' ? 'PAYOUT_REJECT' : 'PAYOUT_PROCESS',
      targetTable: 'Payout',
      targetId: payout.id,
      targetLabel: payout.method || undefined,
      oldValue: { status: payout.status },
      newValue: { status: result.status, ...(reason ? { reason: reason.trim() } : {}), ...(providerRef ? { providerRef } : {}), processedBy: session.email },
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({
      payout: updated ? { ...updated, amount: updated.amount.toString() } : null,
      status: result.status,
    })
  } catch (error) {
    console.error('Payout action error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
