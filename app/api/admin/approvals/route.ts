import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryCodes, guardCrmRequest } from '@/lib/crm/security'
import {
  CRM_ACTIONS,
  canRoleFillPendingApprovalSlot,
  evaluateApprovalEligibility,
  getApprovalSlots,
  isStepUpRequired,
  type ApprovalDecisionRecord,
  type ApprovalTier,
  type CrmActionId,
} from '@/lib/crm/governance'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const scopedCountryCodes = getCrmCountryCodes(security)
    if (scopedCountryCodes !== null && scopedCountryCodes.length === 0) {
      return NextResponse.json(
        { approvals: [], total: 0 },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const approvalMarkets =
      scopedCountryCodes === null
        ? undefined
        : security.isSuperAdmin
          ? ['GLOBAL', ...scopedCountryCodes]
          : scopedCountryCodes

    const approvals = await prisma.crmApprovalRequest.findMany({
      where: {
        status: { in: ['PENDING_APPROVAL', 'ON_HOLD'] },
        ...(approvalMarkets ? { market: { in: approvalMarkets } } : {}),
      },
      include: {
        decisions: {
          orderBy: { decidedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    const visible = approvals.flatMap(row => {
      if (!Object.prototype.hasOwnProperty.call(CRM_ACTIONS, row.actionId)) return []

      const actionId = row.actionId as CrmActionId
      const action = CRM_ACTIONS[actionId]
      const tier = row.tier as ApprovalTier
      const decisions: ApprovalDecisionRecord[] = row.decisions
        .filter(item => item.decision === 'APPROVE' || item.decision === 'REJECT')
        .map(item => ({
          adminId: item.adminId,
          role: item.adminRole as any,
          decision: item.decision as 'APPROVE' | 'REJECT',
          decidedAt: item.decidedAt,
        }))

      const permission = action.approvePermission || action.initiatePermission
      const explicitlyDenied = security.permissionOverrides.some(
        item => item.permission === permission && item.effect === 'DENY'
      )

      const eligibility = evaluateApprovalEligibility({
        actionId,
        tier,
        initiatorAdminId: row.initiatorAdminId,
        approverAdminId: security.adminId,
        approverRole: security.role,
        priorDecisions: decisions,
      })

      const eligibleRole =
        !explicitlyDenied &&
        eligibility.allowed &&
        canRoleFillPendingApprovalSlot(
          security.role,
          getApprovalSlots(actionId, tier),
          decisions
        )

      if (!eligibleRole) return []

      const canApprove =
        row.status === 'PENDING_APPROVAL' &&
        eligibleRole

      return [{
        id: row.id,
        actionId,
        actionLabel: action.label,
        status: row.status,
        tier,
        market: row.market,
        targetType: row.targetType,
        targetId: row.targetId,
        amountMinor: row.amountMinor?.toString() || null,
        currency: row.currency,
        reasonCode: row.reasonCode,
        note: row.note,
        riskFlags: row.riskFlags,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        stepUpRequired: isStepUpRequired(actionId, tier),
        canApprove,
        initiatorAdminId: row.initiatorAdminId,
        decisions: row.decisions.map(item => ({
          adminId: item.adminId,
          adminRole: item.adminRole,
          decision: item.decision,
          reason: item.reason,
          decidedAt: item.decidedAt,
        })),
      }]
    })

    return NextResponse.json(
      { approvals: visible, total: visible.length },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM approvals GET error:', error)
    return NextResponse.json(
      { error: 'Failed to load approval queue' },
      { status: 500 }
    )
  }
}
