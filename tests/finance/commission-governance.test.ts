import { describe, expect, it } from 'vitest'
import { getCrmAction } from '@/lib/crm/governance'

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
  })
})
