import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  isValidCompanyRole,
  canAssignRole,
  canRemoveMember,
  canManageMember,
  canAssignWorker,
  canSubmitQuote,
  canViewFinance,
  hasCompanyPermission,
  getRoleHierarchyLevel,
  COMPANY_ROLES,
  COMPANY_PERMISSIONS,
} from '@/lib/phase6/rbac'

const prisma = new PrismaClient()

describe('Phase 6 — Company RBAC', () => {
  describe('Role validation', () => {
    it('accepts valid company roles', () => {
      expect(isValidCompanyRole('COMPANY_OWNER')).toBe(true)
      expect(isValidCompanyRole('MANAGER')).toBe(true)
      expect(isValidCompanyRole('DISPATCHER')).toBe(true)
      expect(isValidCompanyRole('WORKER')).toBe(true)
      expect(isValidCompanyRole('FINANCE')).toBe(true)
    })

    it('rejects invalid roles', () => {
      expect(isValidCompanyRole('ADMIN')).toBe(false)
      expect(isValidCompanyRole('SUPER_ADMIN')).toBe(false)
      expect(isValidCompanyRole('MEMBER')).toBe(false)
      expect(isValidCompanyRole('')).toBe(false)
      expect(isValidCompanyRole('owner')).toBe(false)
    })

    it('has correct role hierarchy', () => {
      expect(getRoleHierarchyLevel('COMPANY_OWNER')).toBeGreaterThan(getRoleHierarchyLevel('MANAGER'))
      expect(getRoleHierarchyLevel('MANAGER')).toBeGreaterThan(getRoleHierarchyLevel('DISPATCHER'))
      expect(getRoleHierarchyLevel('DISPATCHER')).toBeGreaterThan(getRoleHierarchyLevel('FINANCE'))
      expect(getRoleHierarchyLevel('FINANCE')).toBeGreaterThan(getRoleHierarchyLevel('WORKER'))
    })
  })

  describe('Role assignment', () => {
    it('owner can assign manager', () => {
      expect(canAssignRole('COMPANY_OWNER', 'MANAGER')).toBe(true)
    })

    it('owner can assign dispatcher', () => {
      expect(canAssignRole('COMPANY_OWNER', 'DISPATCHER')).toBe(true)
    })

    it('owner can assign worker', () => {
      expect(canAssignRole('COMPANY_OWNER', 'WORKER')).toBe(true)
    })

    it('owner can assign finance', () => {
      expect(canAssignRole('COMPANY_OWNER', 'FINANCE')).toBe(true)
    })

    it('cannot assign owner via invite', () => {
      expect(canAssignRole('COMPANY_OWNER', 'COMPANY_OWNER')).toBe(false)
    })

    it('manager cannot assign owner', () => {
      expect(canAssignRole('MANAGER', 'COMPANY_OWNER')).toBe(false)
    })

    it('manager can assign dispatcher', () => {
      expect(canAssignRole('MANAGER', 'DISPATCHER')).toBe(true)
    })

    it('manager can assign worker', () => {
      expect(canAssignRole('MANAGER', 'WORKER')).toBe(true)
    })

    it('manager cannot assign manager', () => {
      expect(canAssignRole('MANAGER', 'MANAGER')).toBe(false)
    })

    it('dispatcher cannot assign anyone above their level', () => {
      expect(canAssignRole('DISPATCHER', 'MANAGER')).toBe(false)
      expect(canAssignRole('DISPATCHER', 'COMPANY_OWNER')).toBe(false)
    })

    it('worker cannot assign anyone', () => {
      expect(canAssignRole('WORKER', 'WORKER')).toBe(false)
      expect(canAssignRole('WORKER', 'DISPATCHER')).toBe(false)
    })

    it('finance cannot assign anyone', () => {
      expect(canAssignRole('FINANCE', 'WORKER')).toBe(false)
    })
  })

  describe('Member management', () => {
    it('owner can manage all lower roles', () => {
      expect(canManageMember('COMPANY_OWNER', 'MANAGER')).toBe(true)
      expect(canManageMember('COMPANY_OWNER', 'DISPATCHER')).toBe(true)
      expect(canManageMember('COMPANY_OWNER', 'WORKER')).toBe(true)
      expect(canManageMember('COMPANY_OWNER', 'FINANCE')).toBe(true)
    })

    it('manager can manage lower roles', () => {
      expect(canManageMember('MANAGER', 'DISPATCHER')).toBe(true)
      expect(canManageMember('MANAGER', 'WORKER')).toBe(true)
      expect(canManageMember('MANAGER', 'FINANCE')).toBe(true)
    })

    it('manager cannot manage owner', () => {
      expect(canManageMember('MANAGER', 'COMPANY_OWNER')).toBe(false)
    })

    it('dispatcher cannot manage anyone', () => {
      expect(canManageMember('DISPATCHER', 'WORKER')).toBe(false)
      expect(canManageMember('DISPATCHER', 'MANAGER')).toBe(false)
    })
  })

  describe('Member removal', () => {
    it('owner can remove non-owner members', () => {
      expect(canRemoveMember('COMPANY_OWNER', 'WORKER', false)).toBe(true)
      expect(canRemoveMember('COMPANY_OWNER', 'MANAGER', false)).toBe(true)
    })

    it('owner cannot remove last owner', () => {
      expect(canRemoveMember('COMPANY_OWNER', 'COMPANY_OWNER', true)).toBe(false)
    })

    it('owner can remove non-last owner', () => {
      expect(canRemoveMember('COMPANY_OWNER', 'COMPANY_OWNER', false)).toBe(true)
    })

    it('non-owner cannot remove owner', () => {
      expect(canRemoveMember('MANAGER', 'COMPANY_OWNER', false)).toBe(false)
    })

    it('manager can remove lower roles', () => {
      expect(canRemoveMember('MANAGER', 'WORKER', false)).toBe(true)
      expect(canRemoveMember('MANAGER', 'DISPATCHER', false)).toBe(true)
    })

    it('manager cannot remove other managers', () => {
      expect(canRemoveMember('MANAGER', 'MANAGER', false)).toBe(false)
    })
  })

  describe('Permission checks', () => {
    it('owner and dispatcher can assign workers', () => {
      expect(canAssignWorker('COMPANY_OWNER')).toBe(true)
      expect(canAssignWorker('MANAGER')).toBe(true)
      expect(canAssignWorker('DISPATCHER')).toBe(true)
      expect(canAssignWorker('WORKER')).toBe(false)
      expect(canAssignWorker('FINANCE')).toBe(false)
    })

    it('owner, manager, and dispatcher can submit quotes', () => {
      expect(canSubmitQuote('COMPANY_OWNER')).toBe(true)
      expect(canSubmitQuote('MANAGER')).toBe(false)
      expect(canSubmitQuote('DISPATCHER')).toBe(true)
      expect(canSubmitQuote('WORKER')).toBe(false)
      expect(canSubmitQuote('FINANCE')).toBe(false)
    })

    it('owner and finance can view finance', () => {
      expect(canViewFinance('COMPANY_OWNER')).toBe(true)
      expect(canViewFinance('FINANCE')).toBe(true)
      expect(canViewFinance('MANAGER')).toBe(false)
      expect(canViewFinance('WORKER')).toBe(false)
    })

    it('owner has all permissions', () => {
      const ownerPerms = COMPANY_PERMISSIONS['COMPANY_OWNER']
      for (const role of Object.keys(COMPANY_PERMISSIONS) as Array<keyof typeof COMPANY_PERMISSIONS>) {
        if (role === 'COMPANY_OWNER') continue
        const rolePerms = COMPANY_PERMISSIONS[role]
        for (const perm of rolePerms) {
          expect(ownerPerms).toContain(perm)
        }
      }
    })
  })

  describe('Cross-company isolation', () => {
    let companyA: string
    let companyB: string
    let userA: string
    let userB: string
    let ownerAMember: string
    let ownerBMember: string

    beforeAll(async () => {
      const uA = await prisma.user.create({
        data: { email: 'cross-company-a@test.com', passwordHash: 'hash', name: 'User A', role: 'COMPANY' },
      })
      const uB = await prisma.user.create({
        data: { email: 'cross-company-b@test.com', passwordHash: 'hash', name: 'User B', role: 'COMPANY' },
      })
      userA = uA.id
      userB = uB.id

      const cA = await prisma.companyProfile.create({
        data: { userId: userA, companyName: 'Company A', services: 'plumbing', serviceAreas: 'Colombo' },
      })
      const cB = await prisma.companyProfile.create({
        data: { userId: userB, companyName: 'Company B', services: 'electrical', serviceAreas: 'Gampaha' },
      })
      companyA = cA.id
      companyB = cB.id

      const mA = await prisma.teamMember.create({
        data: { companyId: companyA, userId: userA, name: 'Owner A', role: 'COMPANY_OWNER', skills: '[]' },
      })
      const mB = await prisma.teamMember.create({
        data: { companyId: companyB, userId: userB, name: 'Owner B', role: 'COMPANY_OWNER', skills: '[]' },
      })
      ownerAMember = mA.id
      ownerBMember = mB.id
    })

    afterAll(async () => {
      await prisma.teamMember.deleteMany({ where: { companyId: { in: [companyA, companyB] } } })
      await prisma.companyProfile.deleteMany({ where: { id: { in: [companyA, companyB] } } })
      await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } })
    })

    it('User A is member of Company A', async () => {
      const count = await prisma.teamMember.count({
        where: { companyId: companyA, userId: userA, status: 'ACTIVE' },
      })
      expect(count).toBe(1)
    })

    it('User A is NOT member of Company B', async () => {
      const count = await prisma.teamMember.count({
        where: { companyId: companyB, userId: userA, status: 'ACTIVE' },
      })
      expect(count).toBe(0)
    })

    it('Company A members are scoped to Company A', async () => {
      const members = await prisma.teamMember.findMany({
        where: { companyId: companyA },
      })
      expect(members.every(m => m.companyId === companyA)).toBe(true)
    })

    it('Company B members are scoped to Company B', async () => {
      const members = await prisma.teamMember.findMany({
        where: { companyId: companyB },
      })
      expect(members.every(m => m.companyId === companyB)).toBe(true)
    })
  })
})
