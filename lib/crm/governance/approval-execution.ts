import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/crm/audit'
import {
  executeCrmJobCancellation,
  inspectCrmJobCancellation,
} from '@/lib/crm/jobs/cancellation'
import { buildApprovalPlan } from './approval-engine'
import { tierAtLeast } from './action-registry'
import { resolveCurrentApprovalRisk } from './current-risk'
import type { ApprovalTier } from './types'
import type { AdminRole } from '@/lib/admin-types'

export interface ApprovalExecutionActor {
  adminId: string
  email: string
  role: AdminRole
  ipAddress: string
  userAgent: string | null
}

export interface ApprovalExecutionResult {
  status: string
  executed: boolean
  executionRef?: string | null
}

function higherTier(current: ApprovalTier, stored: ApprovalTier): boolean {
  return current !== stored && tierAtLeast(current, stored)
}

export async function executeApprovedCrmRequest(
  requestId: string,
  actor: ApprovalExecutionActor
): Promise<ApprovalExecutionResult> {
  const request = await prisma.crmApprovalRequest.findUnique({
    where: { id: requestId },
  })
  if (!request) throw new Error('APPROVAL_NOT_FOUND')

  if (request.status === 'SUCCEEDED') {
    return {
      status: request.status,
      executed: false,
      executionRef: request.executionRef,
    }
  }
  if (request.status !== 'APPROVED') {
    return { status: request.status, executed: false }
  }

  const current = await resolveCurrentApprovalRisk(request)
  const plan = buildApprovalPlan({
    ...current.risk,
    actionId: current.actionId,
    market: current.market,
    amountMinor: current.amountMinor,
    currency: current.currency,
  })

  if (plan.risk.decision === 'PROHIBIT') {
    await prisma.$transaction([
      prisma.crmApprovalRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          tier: plan.tier,
          riskFlags: JSON.stringify(plan.risk),
        },
      }),
      prisma.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'EXECUTION_POLICY_PROHIBITED',
          actorAdminId: actor.adminId,
          actorRole: actor.role,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
          metadata: JSON.stringify(plan.risk),
        },
      }),
    ])
    return { status: 'REJECTED', executed: false }
  }

  if (plan.risk.decision === 'HOLD') {
    await prisma.$transaction([
      prisma.crmApprovalRequest.update({
        where: { id: request.id },
        data: {
          status: 'ON_HOLD',
          tier: plan.tier,
          riskFlags: JSON.stringify(plan.risk),
        },
      }),
      prisma.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'EXECUTION_RISK_HOLD',
          actorAdminId: actor.adminId,
          actorRole: actor.role,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
          metadata: JSON.stringify(plan.risk),
        },
      }),
    ])
    return { status: 'ON_HOLD', executed: false }
  }

  const storedTier = request.tier as ApprovalTier
  if (higherTier(plan.tier, storedTier)) {
    await prisma.$transaction([
      prisma.crmApprovalRequest.update({
        where: { id: request.id },
        data: {
          status: 'PENDING_APPROVAL',
          tier: plan.tier,
          policyVersion: plan.risk.policyVersion,
          riskFlags: JSON.stringify(plan.risk),
          requiredApprovers: JSON.stringify(plan.slots),
          expiresAt: plan.expiresAt,
        },
      }),
      prisma.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'EXECUTION_RETIERED',
          actorAdminId: actor.adminId,
          actorRole: actor.role,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
          metadata: JSON.stringify({ from: storedTier, to: plan.tier }),
        },
      }),
    ])
    return { status: 'PENDING_APPROVAL', executed: false }
  }

  const claimed = await prisma.crmApprovalRequest.updateMany({
    where: { id: request.id, status: 'APPROVED' },
    data: { status: 'EXECUTING' },
  })
  if (claimed.count !== 1) {
    const latest = await prisma.crmApprovalRequest.findUnique({
      where: { id: request.id },
      select: { status: true, executionRef: true },
    })
    return {
      status: latest?.status || 'UNKNOWN',
      executed: false,
      executionRef: latest?.executionRef,
    }
  }

  try {
    let executionRef: string

    if (request.actionId === 'jobs.cancel') {
      const source =
        request.targetType === 'MarketplaceJob'
          ? 'V2'
          : request.targetType === 'JobPosting'
            ? 'V1'
            : null
      if (!source) throw new Error('APPROVAL_TARGET_TYPE_INVALID')

      const context = await inspectCrmJobCancellation(request.targetId, source)
      if (!context) throw new Error('APPROVAL_TARGET_NOT_FOUND')

      const result = await executeCrmJobCancellation({
        context,
        actorId: actor.adminId,
        reason: 'CRM approved cancellation',
        approvalRequestId: request.id,
      })

      executionRef = `${request.targetType}:${request.targetId}:CANCELLED`

      await createAuditLog({
        action: 'UPDATE',
        category: 'JOB',
        userId: actor.adminId,
        userEmail: actor.email,
        userRole: actor.role,
        entityType: request.targetType,
        entityId: request.targetId,
        entityName: context.title,
        description: `Approved CRM cancellation executed from ${result.previousStatus}`,
        oldValue: { status: result.previousStatus, approvalRequestId: request.id },
        newValue: { status: 'CANCELLED', approvalRequestId: request.id },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent || undefined,
        riskLevel: 'HIGH',
      })
    } else {
      throw new Error('APPROVAL_ACTION_NOT_IMPLEMENTED')
    }

    await prisma.$transaction([
      prisma.crmApprovalRequest.update({
        where: { id: request.id },
        data: {
          status: 'SUCCEEDED',
          executionRef,
        },
      }),
      prisma.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'EXECUTION_SUCCEEDED',
          actorAdminId: actor.adminId,
          actorRole: actor.role,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
          metadata: JSON.stringify({ executionRef }),
        },
      }),
    ])

    return { status: 'SUCCEEDED', executed: true, executionRef }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Execution failed'

    await prisma.$transaction([
      prisma.crmApprovalRequest.update({
        where: { id: request.id },
        data: { status: 'FAILED' },
      }),
      prisma.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'EXECUTION_FAILED',
          actorAdminId: actor.adminId,
          actorRole: actor.role,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
          metadata: JSON.stringify({ message: message.slice(0, 500) }),
        },
      }),
    ])

    throw error
  }
}
