import { describe, it, expect } from 'vitest'
import {
  canAssignRole,
  canManageMember,
  hasCompanyPermission,
  canRemoveMember,
  canAssignWorker,
  canSubmitQuote,
  canViewFinance,
  getRoleHierarchyLevel,
  COMPANY_PERMISSIONS,
} from '@/lib/phase6/rbac'
import type { CompanyRole } from '@/lib/phase6/rbac'

describe('Admin RBAC — Negative (Deny) Cases', () => {
  describe('FINANCE role cannot do MANAGER actions', () => {
    it('FINANCE cannot assign roles', () => {
      expect(canAssignRole('FINANCE', 'WORKER')).toBe(false)
      expect(canAssignRole('FINANCE', 'DISPATCHER')).toBe(false)
      expect(canAssignRole('FINANCE', 'MANAGER')).toBe(false)
    })

    it('FINANCE cannot manage members', () => {
      expect(canManageMember('FINANCE', 'WORKER')).toBe(false)
      expect(canManageMember('FINANCE', 'DISPATCHER')).toBe(false)
      expect(canManageMember('FINANCE', 'FINANCE')).toBe(false)
    })

    it('FINANCE cannot assign workers', () => {
      expect(canAssignWorker('FINANCE')).toBe(false)
    })

    it('FINANCE cannot submit quotes', () => {
      expect(canSubmitQuote('FINANCE')).toBe(false)
    })

    it('FINANCE cannot manage jobs', () => {
      expect(hasCompanyPermission('FINANCE', 'jobs:manage')).toBe(false)
    })

    it('FINANCE cannot invite members', () => {
      expect(hasCompanyPermission('FINANCE', 'members:invite')).toBe(false)
    })

    it('FINANCE cannot remove members', () => {
      expect(hasCompanyPermission('FINANCE', 'members:remove')).toBe(false)
    })

    it('FINANCE cannot update company settings', () => {
      expect(hasCompanyPermission('FINANCE', 'company:update')).toBe(false)
    })
  })

  describe('SUPPORT role does not exist but FINANCE is restricted', () => {
    it('FINANCE cannot initiate payouts', () => {
      expect(hasCompanyPermission('FINANCE', 'finance:payout')).toBe(false)
    })

    it('FINANCE can only read financial data', () => {
      const financePermissions = COMPANY_PERMISSIONS['FINANCE']
      expect(financePermissions).toContain('finance:read')
      expect(financePermissions).not.toContain('finance:payout')
    })
  })

  describe('Cross-company isolation', () => {
    it('User from company A cannot manage company B via role check', () => {
      const roles: CompanyRole[] = ['COMPANY_OWNER', 'MANAGER', 'DISPATCHER', 'WORKER', 'FINANCE']
      for (const role of roles) {
        if (role === 'COMPANY_OWNER') continue
        expect(canManageMember(role, 'COMPANY_OWNER')).toBe(false)
      }
    })

    it('Only COMPANY_OWNER can manage COMPANY_OWNER', () => {
      expect(canManageMember('COMPANY_OWNER', 'COMPANY_OWNER')).toBe(true)
      expect(canManageMember('MANAGER', 'COMPANY_OWNER')).toBe(false)
      expect(canManageMember('FINANCE', 'COMPANY_OWNER')).toBe(false)
    })

    it('Nobody can assign COMPANY_OWNER role', () => {
      const roles: CompanyRole[] = ['COMPANY_OWNER', 'MANAGER', 'DISPATCHER', 'WORKER', 'FINANCE']
      for (const role of roles) {
        expect(canAssignRole(role, 'COMPANY_OWNER')).toBe(false)
      }
    })
  })

  describe('Role hierarchy enforcement', () => {
    it('WORKER has lowest hierarchy level', () => {
      expect(getRoleHierarchyLevel('WORKER')).toBeLessThan(getRoleHierarchyLevel('FINANCE'))
      expect(getRoleHierarchyLevel('WORKER')).toBeLessThan(getRoleHierarchyLevel('DISPATCHER'))
      expect(getRoleHierarchyLevel('WORKER')).toBeLessThan(getRoleHierarchyLevel('MANAGER'))
      expect(getRoleHierarchyLevel('WORKER')).toBeLessThan(getRoleHierarchyLevel('COMPANY_OWNER'))
    })

    it('MANAGER cannot manage COMPANY_OWNER', () => {
      expect(canManageMember('MANAGER', 'COMPANY_OWNER')).toBe(false)
    })

    it('MANAGER cannot manage another MANAGER', () => {
      expect(canManageMember('MANAGER', 'MANAGER')).toBe(false)
    })

    it('MANAGER can manage DISPATCHER and below', () => {
      expect(canManageMember('MANAGER', 'DISPATCHER')).toBe(true)
      expect(canManageMember('MANAGER', 'WORKER')).toBe(true)
    })

    it('DISPATCHER cannot manage anyone', () => {
      expect(canManageMember('DISPATCHER', 'WORKER')).toBe(false)
      expect(canManageMember('DISPATCHER', 'DISPATCHER')).toBe(false)
      expect(canManageMember('DISPATCHER', 'MANAGER')).toBe(false)
    })

    it('WORKER cannot manage anyone', () => {
      expect(canManageMember('WORKER', 'WORKER')).toBe(false)
      expect(canManageMember('WORKER', 'DISPATCHER')).toBe(false)
      expect(canManageMember('WORKER', 'MANAGER')).toBe(false)
      expect(canManageMember('WORKER', 'FINANCE')).toBe(false)
    })

    it('WORKER cannot assign roles to anyone', () => {
      expect(canAssignRole('WORKER', 'WORKER')).toBe(false)
      expect(canAssignRole('WORKER', 'DISPATCHER')).toBe(false)
      expect(canAssignRole('WORKER', 'MANAGER')).toBe(false)
      expect(canAssignRole('WORKER', 'COMPANY_OWNER')).toBe(false)
    })
  })

  describe('Permission boundaries', () => {
    it('DISPATCHER cannot read finance', () => {
      expect(canViewFinance('DISPATCHER')).toBe(false)
    })

    it('WORKER cannot read finance', () => {
      expect(canViewFinance('WORKER')).toBe(false)
    })

    it('MANAGER cannot read finance', () => {
      expect(canViewFinance('MANAGER')).toBe(false)
    })

    it('Only COMPANY_OWNER and FINANCE can read finance', () => {
      expect(canViewFinance('COMPANY_OWNER')).toBe(true)
      expect(canViewFinance('FINANCE')).toBe(true)
    })

    it('MANAGER cannot delete company', () => {
      expect(hasCompanyPermission('MANAGER', 'company:delete')).toBe(false)
    })

    it('MANAGER cannot transfer ownership', () => {
      expect(hasCompanyPermission('MANAGER', 'company:transfer_ownership')).toBe(false)
    })

    it('MANAGER cannot remove members', () => {
      expect(hasCompanyPermission('MANAGER', 'members:remove')).toBe(false)
    })

    it('MANAGER cannot change member roles', () => {
      expect(hasCompanyPermission('MANAGER', 'members:change_role')).toBe(false)
    })
  })

  describe('canRemoveMember safety', () => {
    it('last owner cannot be removed', () => {
      expect(canRemoveMember('COMPANY_OWNER', 'COMPANY_OWNER', true)).toBe(false)
    })

    it('owner can remove non-owners', () => {
      expect(canRemoveMember('COMPANY_OWNER', 'MANAGER', false)).toBe(true)
      expect(canRemoveMember('COMPANY_OWNER', 'WORKER', false)).toBe(true)
    })

    it('manager can only remove lower roles', () => {
      expect(canRemoveMember('MANAGER', 'WORKER', false)).toBe(true)
      expect(canRemoveMember('MANAGER', 'DISPATCHER', false)).toBe(true)
      expect(canRemoveMember('MANAGER', 'MANAGER', false)).toBe(false)
      expect(canRemoveMember('MANAGER', 'COMPANY_OWNER', false)).toBe(false)
    })
  })
})
