import type { AdminRole } from '@/lib/admin-types'
import { getApprovalSlots, getCrmAction, tierAtLeast, type ApprovalSlot } from './action-registry'
import { evaluateCrmRiskPolicy } from './risk-policy'
import type {
  ApprovalDecisionRecord,
  ApprovalStatus,
  ApprovalTier,
  CrmActionId,
  RiskPolicyContext,
  RiskPolicyResult,
} from './types'

const DEFAULT_EXPIRY_MINUTES: Record<ApprovalTier, number | null> = {
  T0: null,
  T1: 30,
  T2: 30,
  T3: 15,
  T4: 15,
}

export interface ApprovalPlan {
  actionId: CrmActionId
  status: ApprovalStatus
  tier: ApprovalTier
  slots: readonly ApprovalSlot[]
  stepUpRequired: boolean
  expiresAt: Date | null
  risk: RiskPolicyResult
}

export function approvalExpiresAt(
  tier: ApprovalTier,
  now = new Date()
): Date | null {
  const minutes = DEFAULT_EXPIRY_MINUTES[tier]
  return minutes === null ? null : new Date(now.getTime() + minutes * 60_000)
}

export function isStepUpRequired(actionId: CrmActionId, tier: ApprovalTier): boolean {
  const action = getCrmAction(actionId)
  if (!action.stepUpFromTier) return false
  return tierAtLeast(tier, action.stepUpFromTier)
}

export function buildApprovalPlan(
  riskContext: RiskPolicyContext,
  now = new Date()
): ApprovalPlan {
  const risk = evaluateCrmRiskPolicy(riskContext, now)
  const slots = getApprovalSlots(riskContext.actionId, risk.tier)

  let status: ApprovalStatus
  if (risk.decision === 'PROHIBIT') status = 'REJECTED'
  else if (risk.decision === 'HOLD') status = 'ON_HOLD'
  else if (risk.tier === 'T0' || slots.length === 0) status = 'APPROVED'
  else status = 'PENDING_APPROVAL'

  return {
    actionId: riskContext.actionId,
    status,
    tier: risk.tier,
    slots,
    stepUpRequired: isStepUpRequired(riskContext.actionId, risk.tier),
    expiresAt: status === 'PENDING_APPROVAL' || status === 'APPROVED'
      ? approvalExpiresAt(risk.tier, now)
      : null,
    risk,
  }
}

function roleFits(role: AdminRole, slot: ApprovalSlot): boolean {
  return slot.includes(role)
}

export function areApprovalSlotsSatisfied(
  slots: readonly ApprovalSlot[],
  decisions: readonly ApprovalDecisionRecord[]
): boolean {
  if (slots.length === 0) return true

  const approvals = decisions.filter(decision => decision.decision === 'APPROVE')
  if (approvals.length < slots.length) return false

  // Match the most restrictive slot first so a SUPER_ADMIN-only slot cannot
  // accidentally be consumed by a broader Manager/Super slot.
  const orderedSlots = slots
    .map((slot, originalIndex) => ({ slot, originalIndex }))
    .sort((a, b) => a.slot.length - b.slot.length)

  const used = new Set<number>()

  function match(index: number): boolean {
    if (index >= orderedSlots.length) return true
    const slot = orderedSlots[index].slot

    for (let i = 0; i < approvals.length; i += 1) {
      if (used.has(i)) continue
      if (!roleFits(approvals[i].role, slot)) continue

      used.add(i)
      if (match(index + 1)) return true
      used.delete(i)
    }
    return false
  }

  return match(0)
}

export function canRoleFillPendingApprovalSlot(
  role: AdminRole,
  slots: readonly ApprovalSlot[],
  decisions: readonly ApprovalDecisionRecord[]
): boolean {
  const hypothetical: ApprovalDecisionRecord = {
    adminId: '__candidate__',
    role,
    decision: 'APPROVE',
    decidedAt: new Date(0),
  }
  return areApprovalSlotsSatisfied(slots, [...decisions, hypothetical]) ||
    slots.some(slot => roleFits(role, slot))
}
