import { describe, expect, it } from 'vitest'
import {
  approvalExpiresAt,
  areApprovalSlotsSatisfied,
  buildApprovalPlan,
  getApprovalSlots,
  isStepUpRequired,
} from '@/lib/crm/governance'

const lkr = (major: number) => BigInt(major) * 100n

describe('CRM V2 approval engine', () => {
  it('requires maker-checker slot for T2 refunds', () => {
    const slots = getApprovalSlots('finance.refund', 'T2')
    expect(slots).toEqual([['FINANCE', 'MANAGER', 'SUPER_ADMIN']])
  })

  it('requires senior review plus SUPER_ADMIN for T3 finance', () => {
    const slots = getApprovalSlots('finance.payout', 'T3')
    expect(slots).toEqual([
      ['MANAGER', 'SUPER_ADMIN'],
      ['SUPER_ADMIN'],
    ])

    expect(areApprovalSlotsSatisfied(slots, [
      { adminId: 'mgr', role: 'MANAGER', decision: 'APPROVE', decidedAt: new Date() },
      { adminId: 'owner', role: 'SUPER_ADMIN', decision: 'APPROVE', decidedAt: new Date() },
    ])).toBe(true)

    expect(areApprovalSlotsSatisfied(slots, [
      { adminId: 'mgr1', role: 'MANAGER', decision: 'APPROVE', decidedAt: new Date() },
      { adminId: 'mgr2', role: 'MANAGER', decision: 'APPROVE', decidedAt: new Date() },
    ])).toBe(false)
  })

  it('requires distinct approval decisions for multiple slots', () => {
    const slots = getApprovalSlots('finance.refund', 'T3')
    expect(areApprovalSlotsSatisfied(slots, [
      { adminId: 'owner', role: 'SUPER_ADMIN', decision: 'APPROVE', decidedAt: new Date() },
    ])).toBe(false)
  })

  it('builds an ON_HOLD plan for disputed manual escrow release', () => {
    const plan = buildApprovalPlan({
      actionId: 'finance.escrow.manual_release',
      market: 'LK',
      amountMinor: lkr(10_000),
      activeDispute: true,
    })

    expect(plan.status).toBe('ON_HOLD')
    expect(plan.tier).toBe('T2')
    expect(plan.risk.holdCodes).toContain('ACTIVE_DISPUTE')
  })

  it('builds a prohibited plan for refund above refundable amount', () => {
    const plan = buildApprovalPlan({
      actionId: 'finance.refund',
      market: 'LK',
      amountMinor: lkr(50_000),
      remainingRefundableMinor: lkr(20_000),
    })

    expect(plan.status).toBe('REJECTED')
    expect(plan.risk.decision).toBe('PROHIBIT')
  })

  it('requires step-up authentication for configured financial tiers', () => {
    expect(isStepUpRequired('finance.refund', 'T1')).toBe(true)
    expect(isStepUpRequired('finance.escrow.manual_release', 'T2')).toBe(true)
    expect(isStepUpRequired('jobs.reassign', 'T1')).toBe(false)
  })

  it('uses a short expiry for senior approvals', () => {
    const now = new Date('2026-10-01T10:00:00Z')
    expect(approvalExpiresAt('T3', now)?.toISOString()).toBe('2026-10-01T10:15:00.000Z')
    expect(approvalExpiresAt('T1', now)?.toISOString()).toBe('2026-10-01T10:30:00.000Z')
  })
})
