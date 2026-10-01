import { prisma } from '@/lib/prisma'
import {
  areApprovalSlotsSatisfied,
  buildApprovalPlan,
  canRoleFillPendingApprovalSlot,
  isStepUpRequired,
} from './approval-engine'
import {
  CRM_ACTIONS,
  evaluateApprovalEligibility,
  getApprovalSlots,
  getCrmAction,
} from './action-registry'
import type {
  ApprovalDecisionRecord,
  ApprovalStatus,
  ApprovalTier,
  CrmActionId,
  RiskPolicyContext,
} from './types'
import type { AdminRole } from '@/lib/admin-types'
import { isVerifiedCrmStepUp, type VerifiedCrmStepUp } from './step-up'

export class CrmApprovalError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409
  ) {
    super(message)
    this.name = 'CrmApprovalError'
  }
}

export interface CreateCrmApprovalInput {
  actionId: CrmActionId
  initiatorAdminId: string
  market: string
  targetType: string
  targetId: string
  amountMinor?: bigint
  currency?: string
  reasonCode?: string
  note?: string
  idempotencyKey?: string
  risk: Omit<RiskPolicyContext, 'actionId' | 'market' | 'amountMinor' | 'currency'>
}

export interface DecideCrmApprovalInput {
  requestId: string
  approverAdminId: string
  approverRole: AdminRole
  decision: 'APPROVE' | 'REJECT'
  reason?: string
  stepUp?: VerifiedCrmStepUp
  currentRisk: Omit<RiskPolicyContext, 'actionId' | 'market' | 'amountMinor' | 'currency'>
}

function assertId(value: string, label: string): void {
  if (!value || value.length > 160) {
    throw new CrmApprovalError('INVALID_APPROVAL_INPUT', `${label} is invalid.`, 400)
  }
}

function normaliseMarket(value: string): string {
  const market = value.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{2,8}$/.test(market)) {
    throw new CrmApprovalError('INVALID_MARKET', 'Market is invalid.', 400)
  }
  return market
}

function parseActionId(value: string): CrmActionId {
  if (!Object.prototype.hasOwnProperty.call(CRM_ACTIONS, value)) {
    throw new CrmApprovalError('UNKNOWN_CRM_ACTION', 'CRM action is not registered.', 400)
  }
  return value as CrmActionId
}

function tierRank(tier: ApprovalTier): number {
  return { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 }[tier]
}

function requiredApproversJson(actionId: CrmActionId, tier: ApprovalTier): string {
  return JSON.stringify(getApprovalSlots(actionId, tier))
}

function eventMetadata(value: unknown): string {
  return JSON.stringify(value)
}

function isUniqueConflict(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
}

function approvalRequestMatchesInput(
  existing: {
    actionId: string
    initiatorAdminId: string
    market: string
    targetType: string
    targetId: string
    amountMinor: bigint | null
    currency: string | null
  },
  input: CreateCrmApprovalInput,
  market: string
): boolean {
  const inputAmount = input.amountMinor ?? null
  const inputCurrency = input.currency?.toUpperCase() ?? null

  return (
    existing.actionId === input.actionId &&
    existing.initiatorAdminId === input.initiatorAdminId &&
    existing.market === market &&
    existing.targetType === input.targetType &&
    existing.targetId === input.targetId &&
    existing.amountMinor === inputAmount &&
    existing.currency === inputCurrency
  )
}

function assertApprovalIdempotencyMatch(
  existing: {
    actionId: string
    initiatorAdminId: string
    market: string
    targetType: string
    targetId: string
    amountMinor: bigint | null
    currency: string | null
  },
  input: CreateCrmApprovalInput,
  market: string
): void {
  if (!approvalRequestMatchesInput(existing, input, market)) {
    throw new CrmApprovalError(
      'APPROVAL_IDEMPOTENCY_CONFLICT',
      'Idempotency key was already used for a different approval request.',
      409
    )
  }
}

export async function createCrmApprovalRequest(input: CreateCrmApprovalInput) {
  assertId(input.initiatorAdminId, 'Initiator')
  assertId(input.targetType, 'Target type')
  assertId(input.targetId, 'Target ID')
  if (input.reasonCode && input.reasonCode.length > 100) {
    throw new CrmApprovalError('INVALID_REASON_CODE', 'Reason code is too long.', 400)
  }
  if (input.note && input.note.length > 2_000) {
    throw new CrmApprovalError('APPROVAL_NOTE_TOO_LONG', 'Approval note is too long.', 400)
  }
  if (input.idempotencyKey && (input.idempotencyKey.length < 8 || input.idempotencyKey.length > 200)) {
    throw new CrmApprovalError('INVALID_IDEMPOTENCY_KEY', 'Idempotency key is invalid.', 400)
  }

  const market = normaliseMarket(input.market)
  const plan = buildApprovalPlan({
    ...input.risk,
    actionId: input.actionId,
    market,
    amountMinor: input.amountMinor,
    currency: input.currency,
  })

  if (plan.risk.decision === 'PROHIBIT') {
    throw new CrmApprovalError(
      'CRM_ACTION_PROHIBITED',
      'Current policy prohibits this CRM action.',
      409
    )
  }

  if (input.idempotencyKey) {
    const existing = await prisma.crmApprovalRequest.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    })
    if (existing) {
      assertApprovalIdempotencyMatch(existing, input, market)
      return { request: existing, reused: true, plan }
    }
  }

  try {
    const request = await prisma.$transaction(async tx => {
      const created = await tx.crmApprovalRequest.create({
        data: {
          actionId: input.actionId,
          status: plan.status,
          initiatorAdminId: input.initiatorAdminId,
          market,
          targetType: input.targetType,
          targetId: input.targetId,
          amountMinor: input.amountMinor,
          currency: input.currency?.toUpperCase(),
          tier: plan.tier,
          reversibility: getCrmAction(input.actionId).reversibility,
          reasonCode: input.reasonCode,
          note: input.note,
          riskFlags: JSON.stringify({
            decision: plan.risk.decision,
            reasons: plan.risk.reasons,
            holds: plan.risk.holdCodes,
          }),
          policyVersion: plan.risk.policyVersion,
          idempotencyKey: input.idempotencyKey,
          requiredApprovers: requiredApproversJson(input.actionId, plan.tier),
          expiresAt: plan.expiresAt,
        },
      })

      await tx.crmApprovalEvent.createMany({
        data: [
          {
            requestId: created.id,
            eventType: 'REQUEST_CREATED',
            actorAdminId: input.initiatorAdminId,
            market,
            targetType: input.targetType,
            targetId: input.targetId,
            metadata: eventMetadata({ actionId: input.actionId }),
          },
          {
            requestId: created.id,
            eventType: 'POLICY_TIER_CALCULATED',
            actorAdminId: input.initiatorAdminId,
            market,
            targetType: input.targetType,
            targetId: input.targetId,
            metadata: eventMetadata({
              tier: plan.tier,
              decision: plan.risk.decision,
              policyVersion: plan.risk.policyVersion,
            }),
          },
          {
            requestId: created.id,
            eventType: plan.status === 'ON_HOLD' ? 'RISK_HOLD_APPLIED' : 'REQUEST_SUBMITTED',
            actorAdminId: input.initiatorAdminId,
            market,
            targetType: input.targetType,
            targetId: input.targetId,
            metadata: eventMetadata({
              holdCodes: plan.risk.holdCodes,
              reasons: plan.risk.reasons,
            }),
          },
        ],
      })

      return created
    })

    return { request, reused: false, plan }
  } catch (error) {
    if (input.idempotencyKey && isUniqueConflict(error)) {
      const existing = await prisma.crmApprovalRequest.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      })
      if (existing) {
        assertApprovalIdempotencyMatch(existing, input, market)
        return { request: existing, reused: true, plan }
      }
    }
    throw error
  }
}

function decisionRecords(
  rows: readonly { adminId: string; adminRole: string; decision: string; decidedAt: Date }[]
): ApprovalDecisionRecord[] {
  return rows
    .filter(row => row.decision === 'APPROVE' || row.decision === 'REJECT')
    .map(row => ({
      adminId: row.adminId,
      role: row.adminRole as AdminRole,
      decision: row.decision as 'APPROVE' | 'REJECT',
      decidedAt: row.decidedAt,
    }))
}

export async function decideCrmApprovalRequest(input: DecideCrmApprovalInput) {
  assertId(input.requestId, 'Approval request ID')
  assertId(input.approverAdminId, 'Approver')

  const request = await prisma.crmApprovalRequest.findUnique({
    where: { id: input.requestId },
    include: { decisions: true },
  })

  if (!request) {
    throw new CrmApprovalError('APPROVAL_NOT_FOUND', 'Approval request was not found.', 404)
  }

  const actionId = parseActionId(request.actionId)
  const currentStatus = request.status as ApprovalStatus
  if (currentStatus !== 'PENDING_APPROVAL' && currentStatus !== 'ON_HOLD') {
    throw new CrmApprovalError('APPROVAL_NOT_PENDING', 'Approval request is not pending.', 409)
  }

  if (request.expiresAt && request.expiresAt <= new Date()) {
    await prisma.$transaction([
      prisma.crmApprovalRequest.update({
        where: { id: request.id },
        data: { status: 'EXPIRED' },
      }),
      prisma.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'APPROVAL_EXPIRED',
          actorAdminId: input.approverAdminId,
          actorRole: input.approverRole,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
        },
      }),
    ])
    throw new CrmApprovalError('APPROVAL_EXPIRED', 'Approval request has expired.', 409)
  }

  const currentPlan = buildApprovalPlan({
    ...input.currentRisk,
    actionId,
    market: request.market,
    amountMinor: request.amountMinor ?? undefined,
    currency: request.currency ?? undefined,
  })

  if (currentPlan.risk.decision === 'PROHIBIT') {
    await prisma.$transaction([
      prisma.crmApprovalRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          tier: currentPlan.tier,
          riskFlags: JSON.stringify(currentPlan.risk),
        },
      }),
      prisma.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'POLICY_PROHIBITED',
          actorAdminId: input.approverAdminId,
          actorRole: input.approverRole,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
          metadata: JSON.stringify(currentPlan.risk),
        },
      }),
    ])
    throw new CrmApprovalError('CRM_ACTION_PROHIBITED', 'Current policy now prohibits this action.', 409)
  }

  if (currentPlan.risk.decision === 'HOLD') {
    await prisma.$transaction([
      prisma.crmApprovalRequest.update({
        where: { id: request.id },
        data: {
          status: 'ON_HOLD',
          tier: currentPlan.tier,
          riskFlags: JSON.stringify(currentPlan.risk),
          requiredApprovers: requiredApproversJson(actionId, currentPlan.tier),
        },
      }),
      prisma.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'RISK_HOLD_APPLIED',
          actorAdminId: input.approverAdminId,
          actorRole: input.approverRole,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
          metadata: JSON.stringify(currentPlan.risk),
        },
      }),
    ])
    throw new CrmApprovalError('APPROVAL_ON_HOLD', 'Approval is on hold due to current risk policy.', 409)
  }

  const storedTier = request.tier as ApprovalTier
  if (tierRank(currentPlan.tier) > tierRank(storedTier)) {
    await prisma.$transaction([
      prisma.crmApprovalRequest.update({
        where: { id: request.id },
        data: {
          status: 'PENDING_APPROVAL',
          tier: currentPlan.tier,
          policyVersion: currentPlan.risk.policyVersion,
          requiredApprovers: requiredApproversJson(actionId, currentPlan.tier),
          riskFlags: JSON.stringify(currentPlan.risk),
          expiresAt: currentPlan.expiresAt,
        },
      }),
      prisma.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'POLICY_TIER_ESCALATED',
          actorAdminId: input.approverAdminId,
          actorRole: input.approverRole,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
          metadata: JSON.stringify({ from: storedTier, to: currentPlan.tier }),
        },
      }),
    ])
    return { status: 'PENDING_APPROVAL' as const, retiered: true, tier: currentPlan.tier }
  }

  const existingDecisions = decisionRecords(request.decisions)
  const eligibility = evaluateApprovalEligibility({
    actionId,
    tier: currentPlan.tier,
    initiatorAdminId: request.initiatorAdminId,
    approverAdminId: input.approverAdminId,
    approverRole: input.approverRole,
    priorDecisions: existingDecisions,
  })

  if (!eligibility.allowed) {
    throw new CrmApprovalError(
      eligibility.code || 'APPROVER_FORBIDDEN',
      eligibility.reason || 'Approver is not eligible.',
      403
    )
  }

  const slots = getApprovalSlots(actionId, currentPlan.tier)
  if (
    input.decision === 'APPROVE' &&
    !canRoleFillPendingApprovalSlot(input.approverRole, slots, existingDecisions)
  ) {
    throw new CrmApprovalError(
      'APPROVER_SLOT_NOT_NEEDED',
      'This approver role cannot satisfy a remaining approval slot.',
      403
    )
  }

  if (isStepUpRequired(actionId, currentPlan.tier) && !isVerifiedCrmStepUp(input.stepUp)) {
    throw new CrmApprovalError('STEP_UP_REQUIRED', 'Step-up authentication is required.', 403)
  }

  if (input.reason && input.reason.length > 2_000) {
    throw new CrmApprovalError('APPROVAL_REASON_TOO_LONG', 'Approval reason is too long.', 400)
  }

  if (input.decision === 'REJECT') {
    return prisma.$transaction(async tx => {
      await tx.crmApprovalDecision.create({
        data: {
          requestId: request.id,
          adminId: input.approverAdminId,
          adminRole: input.approverRole,
          decision: 'REJECT',
          reason: input.reason,
        },
      })
      const updated = await tx.crmApprovalRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED' },
      })
      await tx.crmApprovalEvent.create({
        data: {
          requestId: request.id,
          eventType: 'APPROVAL_REJECTED',
          actorAdminId: input.approverAdminId,
          actorRole: input.approverRole,
          market: request.market,
          targetType: request.targetType,
          targetId: request.targetId,
          metadata: JSON.stringify({ reason: input.reason || null }),
        },
      })
      return { request: updated, approved: false }
    })
  }

  const newDecision: ApprovalDecisionRecord = {
    adminId: input.approverAdminId,
    role: input.approverRole,
    decision: 'APPROVE',
    decidedAt: new Date(),
  }
  const satisfied = areApprovalSlotsSatisfied(slots, [...existingDecisions, newDecision])

  return prisma.$transaction(async tx => {
    await tx.crmApprovalDecision.create({
      data: {
        requestId: request.id,
        adminId: input.approverAdminId,
        adminRole: input.approverRole,
        decision: 'APPROVE',
        reason: input.reason,
      },
    })
    const updated = await tx.crmApprovalRequest.update({
      where: { id: request.id },
      data: { status: satisfied ? 'APPROVED' : 'PENDING_APPROVAL' },
    })
    await tx.crmApprovalEvent.create({
      data: {
        requestId: request.id,
        eventType: 'APPROVAL_GRANTED',
        actorAdminId: input.approverAdminId,
        actorRole: input.approverRole,
        market: request.market,
        targetType: request.targetType,
        targetId: request.targetId,
        metadata: JSON.stringify({
          tier: currentPlan.tier,
          allSlotsSatisfied: satisfied,
          stepUpVerified: isVerifiedCrmStepUp(input.stepUp),
        }),
      },
    })
    return { request: updated, approved: satisfied }
  })
}
