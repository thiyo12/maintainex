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

export function countSatisfiedApprovalSlots(
  slots: readonly ApprovalSlot[],
  decisions: readonly ApprovalDecisionRecord[]
): number {
  if (slots.length === 0) return 0

  const uniqueByAdmin = new Map<string, ApprovalDecisionRecord>()
  for (const decision of decisions) {
    if (decision.decision === 'APPROVE' && !uniqueByAdmin.has(decision.adminId)) {
      uniqueByAdmin.set(decision.adminId, decision)
    }
  }
  const approvals = [...uniqueByAdmin.values()]

  const orderedSlots = slots
    .map(slot => ({ slot }))
    .sort((a, b) => a.slot.length - b.slot.length)

  let best = 0
  const used = new Set<number>()

  function search(slotIndex: number, matched: number): void {
    best = Math.max(best, matched)
    if (slotIndex >= orderedSlots.length) return

    // It is valid for a current decision set to leave this slot unsatisfied.
    search(slotIndex + 1, matched)

    const slot = orderedSlots[slotIndex].slot
    for (let i = 0; i < approvals.length; i += 1) {
      if (used.has(i)) continue
      if (!roleFits(approvals[i].role, slot)) continue
      used.add(i)
      search(slotIndex + 1, matched + 1)
      used.delete(i)
    }
  }

  search(0, 0)
  return best
}

export function areApprovalSlotsSatisfied(
  slots: readonly ApprovalSlot[],
  decisions: readonly ApprovalDecisionRecord[]
): boolean {
  return countSatisfiedApprovalSlots(slots, decisions) === slots.length
}

export function canRoleFillPendingApprovalSlot(
  role: AdminRole,
  slots: readonly ApprovalSlot[],
  decisions: readonly ApprovalDecisionRecord[]
): boolean {
  const before = countSatisfiedApprovalSlots(slots, decisions)
  const hypothetical: ApprovalDecisionRecord = {
    adminId: '__candidate__',
    role,
    decision: 'APPROVE',
    decidedAt: new Date(0),
  }
  const after = countSatisfiedApprovalSlots(slots, [...decisions, hypothetical])
  return after > before
}
