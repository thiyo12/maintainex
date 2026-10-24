import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/crm/audit'
import {
  executeCrmJobCancellation,
  inspectCrmJobCancellation,
} from '@/lib/crm/jobs/cancellation'
import { buildApprovalPlan } from './approval-engine'
import { requestRequiredProviderRefund } from '@/lib/finance/payments/payment-service'
import { releaseEscrow } from '@/lib/finance/escrow/escrow-service'
import { tierAtLeast } from './action-registry'
import { resolveCurrentApprovalRisk } from './current-risk'
import { postApprovedCommissionBankReconciliation } from '@/lib/finance/commissions/bank-credit-reconciliation'
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

type RefundExecutionPayload =
  | { mode: 'REQUEST_GATEWAY_REFUND' }
  | { mode: 'CONFIRM_MANUAL' }

function parseRefundExecutionPayload(raw: string | null): RefundExecutionPayload {
  if (!raw) throw new Error('APPROVAL_ACTION_PAYLOAD_MISSING')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('APPROVAL_ACTION_PAYLOAD_INVALID')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('APPROVAL_ACTION_PAYLOAD_INVALID')
  }

  const value = parsed as Record<string, unknown>
  if (value.mode === 'REQUEST_GATEWAY_REFUND') {
    return { mode: 'REQUEST_GATEWAY_REFUND' }
  }

  if (value.mode === 'CONFIRM_MANUAL') {
    return { mode: 'CONFIRM_MANUAL' }
  }

  throw new Error('APPROVAL_ACTION_PAYLOAD_INVALID')
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

    if (request.actionId === 'finance.refund') {
      if (request.targetType !== 'PaymentIntent') {
        throw new Error('APPROVAL_TARGET_TYPE_INVALID')
      }

      const payload = parseRefundExecutionPayload(request.actionPayload)
      if (payload.mode !== 'REQUEST_GATEWAY_REFUND') {
        throw new Error('REFUND_EXTERNAL_EVIDENCE_REQUIRED')
      }
      const result = await requestRequiredProviderRefund(request.targetId, request.id)

      if (!result.success) {
        throw new Error(`REFUND_EXECUTION_FAILED:${result.code || result.error || 'UNKNOWN'}`)
      }

      executionRef =
        result.refundReference ||
        `PaymentIntent:${request.targetId}:${result.status}`

      await createAuditLog({
        action: 'UPDATE',
        category: 'FINANCE',
        userId: actor.adminId,
        userEmail: actor.email,
        userRole: actor.role,
        entityType: 'PaymentIntent',
        entityId: request.targetId,
        entityName: request.targetId,
        description: 'Approved provider refund request executed',
        oldValue: {
          approvalRequestId: request.id,
        },
        newValue: {
          status: result.status,
          approvalRequestId: request.id,
          refundReferencePresent: Boolean(result.refundReference),
          mode: payload.mode,
        },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent || undefined,
        riskLevel: 'CRITICAL',
      })
    } else if (request.actionId === 'finance.escrow.manual_release') {
      if (request.targetType !== 'JobEscrow') {
        throw new Error('APPROVAL_TARGET_TYPE_INVALID')
      }

      const escrow = await prisma.jobEscrow.findUnique({
        where: { id: request.targetId },
        select: {
          id: true,
          jobId: true,
          status: true,
          totalAmount: true,
          currency: true,
          paymentMethod: true,
        },
      })
      if (!escrow) throw new Error('APPROVAL_TARGET_NOT_FOUND')
      if (!['PROTECTED', 'ON_HOLD'].includes(escrow.status)) {
        throw new Error(`ESCROW_STATUS_NOT_EXECUTABLE:${escrow.status}`)
      }
      if (escrow.paymentMethod === 'CASH') {
        throw new Error('CASH_PAYMENT_DISABLED')
      }

      const released = await releaseEscrow(
        {
          jobId: escrow.jobId,
          actorId: actor.adminId,
          actorType: 'STAFF',
          reason: 'CRM approved manual escrow release',
          metadata: { approvalRequestId: request.id },
        },
        escrow.jobId,
      )

      executionRef = `JobEscrow:${escrow.id}:RELEASED`

      await createAuditLog({
        action: 'UPDATE',
        category: 'FINANCE',
        userId: actor.adminId,
        userEmail: actor.email,
        userRole: actor.role,
        entityType: 'JobEscrow',
        entityId: escrow.id,
        entityName: escrow.jobId,
        description: 'Approved manual escrow release executed',
        oldValue: {
          status: escrow.status,
          approvalRequestId: request.id,
        },
        newValue: {
          status: 'RELEASED',
          approvalRequestId: request.id,
          amountMinor: escrow.totalAmount.toString(),
          currency: escrow.currency,
          providerNetMinor: released.netCents.toString(),
          commissionMinor: released.commissionCents.toString(),
        },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent || undefined,
        riskLevel: 'CRITICAL',
      })
    } else if (request.actionId === 'finance.payout') {
      // Old approval requests only carry a user-entered reference. That is not
      // independent PSP/bank evidence, so they must not create a paid payout.
      throw new Error('PAYOUT_EXTERNAL_EVIDENCE_REQUIRED')
    } else if (request.actionId === 'finance.commission.reconcile') {
      if (request.targetType !== 'CommissionBankTransaction' || !request.actionPayload) {
        throw new Error('APPROVAL_TARGET_TYPE_INVALID')
      }
      let payload: unknown
      try {
        payload = JSON.parse(request.actionPayload)
      } catch {
        throw new Error('APPROVAL_ACTION_PAYLOAD_INVALID')
      }
      if (
        !payload || typeof payload !== 'object' || Array.isArray(payload) ||
        (payload as Record<string, unknown>).mode !== 'BANK_CREDIT' ||
        (payload as Record<string, unknown>).bankTransactionId !== request.targetId
      ) {
        throw new Error('APPROVAL_ACTION_PAYLOAD_INVALID')
      }
      await postApprovedCommissionBankReconciliation({
        bankTransactionId: request.targetId,
        actorAdminId: actor.adminId,
        approvalRequestId: request.id,
      })
      executionRef = `CommissionBankTransaction:${request.targetId}:POSTED`
    } else if (request.actionId === 'jobs.cancel') {
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
