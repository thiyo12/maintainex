import { describe, expect, it } from 'vitest'
import {
  assertApprovalTransition,
  canTransitionApproval,
  evaluateApprovalEligibility,
  evaluateCrmRiskPolicy,
  getCrmAction,
  isTerminalApprovalStatus,
} from '@/lib/crm/governance'

const lkr = (major: number) => BigInt(major) * 100n

describe('CRM V2 governance foundation', () => {
  it('maps high-risk actions to explicit owners and approvers', () => {
    const refund = getCrmAction('finance.refund')
    expect(refund.ownerRoles).toContain('FINANCE')
    expect(refund.approverRoles.T2).toContain('MANAGER')
    expect(refund.reversibility).toBe('R3')

    const staffRole = getCrmAction('staff.role.change')
    expect(staffRole.permissionClass).toBe('OWNER_ONLY')
    expect(staffRole.ownerRoles).toEqual(['SUPER_ADMIN'])
  })

  it('forbids self approval for maker-checker tiers', () => {
    const result = evaluateApprovalEligibility({
      actionId: 'finance.refund',
      tier: 'T2',
      initiatorAdminId: 'admin-1',
      approverAdminId: 'admin-1',
      approverRole: 'FINANCE',
    })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe('SELF_APPROVAL_FORBIDDEN')
  })

  it('rejects duplicate approvers', () => {
    const result = evaluateApprovalEligibility({
      actionId: 'finance.refund',
      tier: 'T2',
      initiatorAdminId: 'admin-1',
      approverAdminId: 'admin-2',
      approverRole: 'MANAGER',
      priorDecisions: [
        { adminId: 'admin-2', role: 'MANAGER', decision: 'APPROVE', decidedAt: new Date() },
      ],
    })
    expect(result.allowed).toBe(false)
    expect(result.code).toBe('DUPLICATE_APPROVER')
  })

  it('enforces approval state transitions', () => {
    expect(canTransitionApproval('DRAFT', 'SUBMITTED')).toBe(true)
    expect(canTransitionApproval('PENDING_APPROVAL', 'APPROVED')).toBe(true)
    expect(canTransitionApproval('SUCCEEDED', 'PENDING_APPROVAL')).toBe(false)
    expect(isTerminalApprovalStatus('SUCCEEDED')).toBe(true)
    expect(() => assertApprovalTransition('SUCCEEDED', 'EXECUTING')).toThrow()
  })

  it('calculates refund tier by amount', () => {
    expect(evaluateCrmRiskPolicy({
      actionId: 'finance.refund',
      market: 'LK',
      currency: 'LKR',
      amountMinor: lkr(20_000),
      remainingRefundableMinor: lkr(20_000),
    }).tier).toBe('T1')

    expect(evaluateCrmRiskPolicy({
      actionId: 'finance.refund',
      market: 'LK',
      currency: 'LKR',
      amountMinor: lkr(75_000),
      remainingRefundableMinor: lkr(75_000),
    }).tier).toBe('T2')

    expect(evaluateCrmRiskPolicy({
      actionId: 'finance.refund',
      market: 'LK',
      currency: 'LKR',
      amountMinor: lkr(600_000),
      remainingRefundableMinor: lkr(600_000),
    }).tier).toBe('T4')
  })

  it('prohibits refund above remaining refundable amount', () => {
    const result = evaluateCrmRiskPolicy({
      actionId: 'finance.refund',
      market: 'LK',
      amountMinor: lkr(50_000),
      remainingRefundableMinor: lkr(20_000),
    })
    expect(result.decision).toBe('PROHIBIT')
    expect(result.prohibitCodes).toContain('REFUND_EXCEEDS_REMAINING')
  })

  it('holds manual escrow release when dispute is active', () => {
    const result = evaluateCrmRiskPolicy({
      actionId: 'finance.escrow.manual_release',
      market: 'LK',
      amountMinor: lkr(10_000),
      activeDispute: true,
    })
    expect(result.tier).toBe('T2')
    expect(result.decision).toBe('HOLD')
    expect(result.holdCodes).toContain('ACTIVE_DISPUTE')
  })

  it('forces payout cooling hold and T4 after recent destination change', () => {
    const now = new Date('2026-10-01T10:00:00Z')
    const result = evaluateCrmRiskPolicy({
      actionId: 'finance.payout',
      market: 'LK',
      amountMinor: lkr(50_000),
      kycStatus: 'APPROVED',
      payoutDestinationChangedAt: new Date('2026-09-30T10:00:00Z'),
    }, now)

    expect(result.tier).toBe('T4')
    expect(result.decision).toBe('HOLD')
    expect(result.holdCodes).toContain('PAYOUT_DESTINATION_COOLING')
  })

  it('holds payout when KYC is not approved', () => {
    const result = evaluateCrmRiskPolicy({
      actionId: 'finance.payout',
      market: 'LK',
      amountMinor: lkr(10_000),
      kycStatus: 'EXPIRED',
    })
    expect(result.decision).toBe('HOLD')
    expect(result.holdCodes).toContain('PAYOUT_KYC_NOT_APPROVED')
  })

  it('escalates suspected threshold splitting', () => {
    const result = evaluateCrmRiskPolicy({
      actionId: 'finance.refund',
      market: 'LK',
      amountMinor: lkr(20_000),
      remainingRefundableMinor: lkr(20_000),
      suspectedThresholdSplitting: true,
    })
    expect(result.tier).toBe('T3')
    expect(result.decision).toBe('ESCALATE')
  })

  it('prohibits staff self escalation attempts', () => {
    const result = evaluateCrmRiskPolicy({
      actionId: 'staff.permission.change',
      market: 'LK',
      selfEscalationAttempt: true,
    })
    expect(result.decision).toBe('PROHIBIT')
    expect(result.prohibitCodes).toContain('SELF_ESCALATION')
  })
})
