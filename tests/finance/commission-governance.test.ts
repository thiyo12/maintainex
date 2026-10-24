import { describe, expect, it } from 'vitest'
import { evaluateApprovalEligibility, getApprovalSlots, getCrmAction } from '@/lib/crm/governance'

describe('commission governance actions', () => {
  it('requires step-up for commission enforcement', () => {
    const action = getCrmAction('finance.commission.enforce')
    expect(action.permissionClass).toBe('SENSITIVE')
    expect(action.stepUpFromTier).toBe('T1')
    expect(action.requiresMarketScope).toBe(true)
    expect(action.breakGlass).toBe('SAFER_STATE_ONLY')
  })

  it('requires step-up for payment reconciliation and keeps it finance-owned', () => {
    const action = getCrmAction('finance.commission.reconcile')
    expect(action.permissionClass).toBe('SENSITIVE')
    expect(action.stepUpFromTier).toBe('T1')
    expect(action.reversibility).toBe('R3')
    expect(action.ownerRoles).toEqual(['FINANCE', 'SUPER_ADMIN'])
    expect(action.initiatorRoles).toEqual(['FINANCE', 'SUPER_ADMIN'])
    expect(action.makerCheckerFromTier).toBe('T1')
    expect(getApprovalSlots('finance.commission.reconcile', 'T1')).toEqual([['FINANCE', 'SUPER_ADMIN']])
  })

  it('requires a different Finance identity to approve a bank reconciliation', () => {
    const eligibility = evaluateApprovalEligibility({
      actionId: 'finance.commission.reconcile',
      tier: 'T1',
      approverRole: 'FINANCE',
      approverAdminId: 'maker-1',
      initiatorAdminId: 'maker-1',
    })
    expect(eligibility).toMatchObject({ allowed: false, code: 'SELF_APPROVAL_FORBIDDEN' })
  })
})
