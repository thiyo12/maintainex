import { describe, expect, it } from 'vitest'
import {
  crmAccountActionRequiresReason,
  getCrmAccountActionPermission,
} from '@/lib/crm/account-action-permissions'
import { crmHasPermission } from '@/lib/crm/security'

describe('CRM account action permissions', () => {
  it('uses customer permissions for customer restrictions', () => {
    expect(getCrmAccountActionPermission('suspend', 'CUSTOMER')).toBe('users:suspend')
    expect(getCrmAccountActionPermission('ban', 'CUSTOMER')).toBe('users:ban')
  })

  it('uses tasker permissions for tasker restrictions', () => {
    expect(getCrmAccountActionPermission('suspend', 'TASKER')).toBe('taskers:edit')
    expect(getCrmAccountActionPermission('ban', 'TASKER')).toBe('taskers:ban')
    expect(getCrmAccountActionPermission('verify_tasker', 'TASKER')).toBe('taskers:verify')
  })

  it('uses company permissions for company restrictions', () => {
    expect(getCrmAccountActionPermission('suspend', 'COMPANY')).toBe('companies:edit')
    expect(getCrmAccountActionPermission('ban', 'COMPANY')).toBe('companies:ban')
    expect(getCrmAccountActionPermission('verify_company', 'COMPANY')).toBe('companies:verify')
  })

  it('allows managers to suspend providers but not ban them', () => {
    expect(crmHasPermission('MANAGER', getCrmAccountActionPermission('suspend', 'TASKER')!)).toBe(true)
    expect(crmHasPermission('MANAGER', getCrmAccountActionPermission('suspend', 'COMPANY')!)).toBe(true)
    expect(crmHasPermission('MANAGER', getCrmAccountActionPermission('ban', 'TASKER')!)).toBe(false)
    expect(crmHasPermission('MANAGER', getCrmAccountActionPermission('ban', 'COMPANY')!)).toBe(false)
  })

  it('does not grant managers customer suspension through provider permissions', () => {
    expect(crmHasPermission('MANAGER', getCrmAccountActionPermission('suspend', 'CUSTOMER')!)).toBe(false)
  })

  it('allows user management to apply supported restrictions', () => {
    for (const targetRole of ['CUSTOMER', 'TASKER', 'COMPANY']) {
      expect(crmHasPermission(
        'USER_MANAGEMENT',
        getCrmAccountActionPermission('suspend', targetRole)!
      )).toBe(true)
      expect(crmHasPermission(
        'USER_MANAGEMENT',
        getCrmAccountActionPermission('ban', targetRole)!
      )).toBe(true)
    }
  })

  it('requires reasons for destructive/rejection actions only', () => {
    expect(crmAccountActionRequiresReason('suspend')).toBe(true)
    expect(crmAccountActionRequiresReason('ban')).toBe(true)
    expect(crmAccountActionRequiresReason('reject_tasker')).toBe(true)
    expect(crmAccountActionRequiresReason('reject_company')).toBe(true)
    expect(crmAccountActionRequiresReason('unsuspend')).toBe(false)
    expect(crmAccountActionRequiresReason('unban')).toBe(false)
    expect(crmAccountActionRequiresReason('verify_tasker')).toBe(false)
    expect(crmAccountActionRequiresReason('verify_company')).toBe(false)
  })
})
