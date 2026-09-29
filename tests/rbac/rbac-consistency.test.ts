import { describe, it, expect } from 'vitest'
import {
  COMPANY_PERMISSIONS,
  hasCompanyPermission,
  canAssignRole,
  canManageMember,
  canRemoveMember,
  canAssignWorker,
  canSubmitQuote,
  canViewFinance,
  CompanyRole,
} from '@/lib/phase6/rbac'

describe('Phase 6.1 — Company RBAC Single Source of Truth', () => {
  const ALL_ROLES: CompanyRole[] = ['COMPANY_OWNER', 'MANAGER', 'DISPATCHER', 'WORKER', 'FINANCE']

  describe('Permission matrix consistency', () => {
    it('canAssignWorker delegates to hasCompanyPermission', () => {
      for (const role of ALL_ROLES) {
        expect(canAssignWorker(role)).toBe(hasCompanyPermission(role, 'workers:assign'))
      }
    })

    it('canSubmitQuote delegates to hasCompanyPermission', () => {
      for (const role of ALL_ROLES) {
        expect(canSubmitQuote(role)).toBe(hasCompanyPermission(role, 'quotes:submit'))
      }
    })

    it('canViewFinance delegates to hasCompanyPermission', () => {
      for (const role of ALL_ROLES) {
        expect(canViewFinance(role)).toBe(hasCompanyPermission(role, 'finance:read'))
      }
    })
  })

  describe('Approved policy enforcement', () => {
    it('MANAGER has no finance:read', () => {
      expect(hasCompanyPermission('MANAGER', 'finance:read')).toBe(false)
      expect(canViewFinance('MANAGER')).toBe(false)
    })

    it('DISPATCHER has quotes:submit', () => {
      expect(hasCompanyPermission('DISPATCHER', 'quotes:submit')).toBe(true)
      expect(canSubmitQuote('DISPATCHER')).toBe(true)
    })

    it('WORKER has only read permissions', () => {
      expect(hasCompanyPermission('WORKER', 'members:invite')).toBe(false)
      expect(hasCompanyPermission('WORKER', 'workers:assign')).toBe(false)
      expect(hasCompanyPermission('WORKER', 'finance:read')).toBe(false)
      expect(hasCompanyPermission('WORKER', 'certifications:manage')).toBe(false)
    })

    it('FINANCE has finance:read but not members:invite', () => {
      expect(hasCompanyPermission('FINANCE', 'finance:read')).toBe(true)
      expect(hasCompanyPermission('FINANCE', 'members:invite')).toBe(false)
      expect(hasCompanyPermission('FINANCE', 'workers:assign')).toBe(false)
    })

    it('COMPANY_OWNER has full permissions', () => {
      const ownerPerms = COMPANY_PERMISSIONS['COMPANY_OWNER']
      expect(ownerPerms).toContain('company:read')
      expect(ownerPerms).toContain('company:update')
      expect(ownerPerms).toContain('company:delete')
      expect(ownerPerms).toContain('members:invite')
      expect(ownerPerms).toContain('members:remove')
      expect(ownerPerms).toContain('workers:assign')
      expect(ownerPerms).toContain('finance:read')
      expect(ownerPerms).toContain('finance:payout')
      expect(ownerPerms).toContain('certifications:manage')
      expect(ownerPerms).toContain('audit:read')
    })
  })

  describe('Hierarchy enforcement', () => {
    it('only owner and manager can assign roles', () => {
      expect(canAssignRole('COMPANY_OWNER', 'WORKER')).toBe(true)
      expect(canAssignRole('MANAGER', 'WORKER')).toBe(true)
      expect(canAssignRole('DISPATCHER', 'WORKER')).toBe(false)
      expect(canAssignRole('WORKER', 'WORKER')).toBe(false)
      expect(canAssignRole('FINANCE', 'WORKER')).toBe(false)
    })

    it('cannot assign COMPANY_OWNER role', () => {
      expect(canAssignRole('COMPANY_OWNER', 'COMPANY_OWNER')).toBe(false)
    })

    it('manager cannot assign manager or above', () => {
      expect(canAssignRole('MANAGER', 'MANAGER')).toBe(false)
      expect(canAssignRole('MANAGER', 'COMPANY_OWNER')).toBe(false)
    })
  })
})
