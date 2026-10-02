import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  guardCrmRequest,
} from '@/lib/crm/security'
import {
  CRM_ACTIONS,
  CrmApprovalError,
  decideCrmApprovalRequest,
  isStepUpRequired,
  type ApprovalTier,
  type CrmActionId,
} from '@/lib/crm/governance'
import { consumeCrmStepUpFromHeader } from '@/lib/crm/governance/step-up'
import { resolveCurrentApprovalRisk } from '@/lib/crm/governance/current-risk'
import { executeApprovedCrmRequest } from '@/lib/crm/governance/approval-execution'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, { level: 'sensitive' })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 160) {
      return NextResponse.json({ error: 'Invalid approval ID' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const decision = body?.decision === 'APPROVE'
      ? 'APPROVE'
      : body?.decision === 'REJECT'
        ? 'REJECT'
        : null
    const reason = typeof body?.reason === 'string'
      ? body.reason.trim().slice(0, 2000)
      : undefined

    if (!decision) {
      return NextResponse.json({ error: 'Decision must be APPROVE or REJECT' }, { status: 400 })
    }

    const approval = await prisma.crmApprovalRequest.findUnique({
      where: { id },
      include: { decisions: true },
    })
    if (!approval) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
    }

    if (
      approval.market === 'GLOBAL'
        ? !security.isSuperAdmin
        : !assertCrmCountryAllowed(security, approval.market)
    ) {
      return NextResponse.json({ error: 'Approval is outside your market scope' }, { status: 403 })
    }

    if (!Object.prototype.hasOwnProperty.call(CRM_ACTIONS, approval.actionId)) {
      return NextResponse.json({ error: 'Unknown approval action' }, { status: 409 })
    }

    const actionId = approval.actionId as CrmActionId
    const action = CRM_ACTIONS[actionId]
    const approvalPermission = action.approvePermission || action.initiatePermission

    if (security.permissionOverrides.some(
      item => item.permission === approvalPermission && item.effect === 'DENY'
    )) {
      return NextResponse.json({ error: 'Approval permission denied' }, { status: 403 })
    }

    const current = await resolveCurrentApprovalRisk(approval)
    let stepUp

    if (isStepUpRequired(actionId, approval.tier as ApprovalTier)) {
      stepUp = await consumeCrmStepUpFromHeader({
        headerValue: request.headers.get('x-crm-step-up'),
        adminUserId: security.adminId,
        sessionId: security.sessionId,
        actionId,
      })
      if (!stepUp) {
        return NextResponse.json(
          { error: 'Step-up authentication required', code: 'STEP_UP_REQUIRED' },
          { status: 403 }
        )
      }
    }

    const result = await decideCrmApprovalRequest({
      requestId: approval.id,
      approverAdminId: security.adminId,
      approverRole: security.role,
      decision,
      reason,
      stepUp,
      currentRisk: current.risk,
    })

    if ('retiered' in result && result.retiered) {
      return NextResponse.json({
        approval: {
          id: approval.id,
          status: result.status,
          tier: result.tier,
        },
        execution: null,
      }, { status: 202 })
    }

    if ('approved' in result && result.approved) {
      const execution = await executeApprovedCrmRequest(approval.id, {
        adminId: security.adminId,
        email: security.email,
        role: security.role,
        ipAddress: security.ipAddress,
        userAgent: security.userAgent,
      })

      return NextResponse.json({
        approval: {
          id: approval.id,
          status: execution.status,
        },
        execution,
      })
    }

    return NextResponse.json({
      approval: {
        id: approval.id,
        status: 'request' in result ? result.request.status : 'PENDING_APPROVAL',
      },
      execution: null,
    })
  } catch (error) {
    if (error instanceof CrmApprovalError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }

    const message = error instanceof Error ? error.message : 'Approval decision failed'
    console.error('CRM approval decision error:', error)

    if (message.startsWith('APPROVAL_')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    return NextResponse.json({ error: 'Approval decision failed' }, { status: 500 })
  }
}
