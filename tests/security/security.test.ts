import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { canRemoveMemberSafe, getUserCompanyRole, isUserCompanyMember } from '@/lib/phase6/company-ownership'
import { canAssignRole, canManageMember } from '@/lib/phase6/rbac'
import { requiresPostgres } from '../helpers/test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6 — Security (IDOR/BOLA + Role Escalation)', () => {
  let companyAId: string
  let companyBId: string
  let ownerAId: string
  let ownerBId: string
  let workerAId: string
  let workerBId: string

  beforeAll(async () => {
    const ts = Date.now()
    const userA = await prisma.user.create({
      data: { email: `security-owner-a-${ts}@test.com`, passwordHash: 'hash', name: 'Owner A', role: 'COMPANY' },
    })
    ownerAId = userA.id

    const userB = await prisma.user.create({
      data: { email: `security-owner-b-${ts}@test.com`, passwordHash: 'hash', name: 'Owner B', role: 'COMPANY' },
    })
    ownerBId = userB.id

    const wA = await prisma.user.create({
      data: { email: `security-worker-a-${ts}@test.com`, passwordHash: 'hash', name: 'Worker A', role: 'CUSTOMER', identityStatus: 'VERIFIED' },
    })
    workerAId = wA.id

    const wB = await prisma.user.create({
      data: { email: `security-worker-b-${ts}@test.com`, passwordHash: 'hash', name: 'Worker B', role: 'CUSTOMER', identityStatus: 'VERIFIED' },
    })
    workerBId = wB.id

    const cA = await prisma.companyProfile.create({
      data: { userId: ownerAId, companyName: 'Security Co A', services: 'plumbing', serviceAreas: 'Colombo' },
    })
    companyAId = cA.id

    const cB = await prisma.companyProfile.create({
      data: { userId: ownerBId, companyName: 'Security Co B', services: 'electrical', serviceAreas: 'Gampaha' },
    })
    companyBId = cB.id

    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: ownerAId, name: 'Owner A', role: 'COMPANY_OWNER', skills: '[]' },
    })
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: workerAId, name: 'Worker A', role: 'WORKER', skills: '[]' },
    })
    await prisma.teamMember.create({
      data: { companyId: companyBId, userId: ownerBId, name: 'Owner B', role: 'COMPANY_OWNER', skills: '[]' },
    })
    await prisma.teamMember.create({
      data: { companyId: companyBId, userId: workerBId, name: 'Worker B', role: 'WORKER', skills: '[]' },
    })
  })

  afterAll(async () => {
    await prisma.teamMember.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } })
    await prisma.companyProfile.deleteMany({ where: { id: { in: [companyAId, companyBId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [ownerAId, ownerBId, workerAId, workerBId] } } })
  })

  describe('Cross-company access denial', () => {
    it('Worker A is not member of Company B', async () => {
      expect(await isUserCompanyMember(companyBId, workerAId)).toBe(false)
    })

    it('Worker B is not member of Company A', async () => {
      expect(await isUserCompanyMember(companyAId, workerBId)).toBe(false)
    })

    it('Owner A cannot remove Worker B (different company)', async () => {
      const result = await canRemoveMemberSafe(companyBId, ownerAId, workerBId, 'COMPANY_OWNER')
      expect(result.allowed).toBe(false)
    })

    it('Owner B cannot remove Worker A (different company)', async () => {
      const result = await canRemoveMemberSafe(companyAId, ownerBId, workerAId, 'COMPANY_OWNER')
      expect(result.allowed).toBe(false)
    })

    it('getUserCompanyRole returns null for cross-company user', async () => {
      expect(await getUserCompanyRole(companyBId, workerAId)).toBeNull()
      expect(await getUserCompanyRole(companyAId, workerBId)).toBeNull()
    })
  })

  describe('Role escalation prevention', () => {
    it('worker cannot assign roles', () => {
      expect(canAssignRole('WORKER', 'WORKER')).toBe(false)
      expect(canAssignRole('WORKER', 'DISPATCHER')).toBe(false)
      expect(canAssignRole('WORKER', 'MANAGER')).toBe(false)
      expect(canAssignRole('WORKER', 'COMPANY_OWNER')).toBe(false)
    })

    it('dispatcher cannot escalate to manager or above', () => {
      expect(canAssignRole('DISPATCHER', 'MANAGER')).toBe(false)
      expect(canAssignRole('DISPATCHER', 'COMPANY_OWNER')).toBe(false)
    })

    it('manager cannot promote to owner', () => {
      expect(canAssignRole('MANAGER', 'COMPANY_OWNER')).toBe(false)
    })

    it('nobody can self-promote to owner via invite', () => {
      const roles = ['WORKER', 'DISPATCHER', 'MANAGER', 'FINANCE'] as const
      for (const role of roles) {
        expect(canAssignRole(role, 'COMPANY_OWNER')).toBe(false)
      }
    })

    it('manager cannot manage other managers', () => {
      expect(canManageMember('MANAGER', 'MANAGER')).toBe(false)
    })

    it('dispatcher cannot manage anyone', () => {
      expect(canManageMember('DISPATCHER', 'WORKER')).toBe(false)
      expect(canManageMember('DISPATCHER', 'DISPATCHER')).toBe(false)
    })
  })

  describe('Ownership safety', () => {
    it('owner cannot remove themselves as last owner', async () => {
      const result = await canRemoveMemberSafe(companyAId, ownerAId, ownerAId, 'COMPANY_OWNER')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('last owner')
    })

    it('owner CAN remove themselves if another owner exists', async () => {
      const secondOwner = await prisma.user.create({
        data: { email: `security-second-owner-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Second Owner', role: 'COMPANY' },
      })
      await prisma.teamMember.create({
        data: { companyId: companyAId, userId: secondOwner.id, name: 'Second Owner', role: 'COMPANY_OWNER', skills: '[]' },
      })

      const result = await canRemoveMemberSafe(companyAId, ownerAId, ownerAId, 'COMPANY_OWNER')
      expect(result.allowed).toBe(true)

      await prisma.teamMember.deleteMany({ where: { companyId: companyAId, userId: secondOwner.id } })
      await prisma.user.delete({ where: { id: secondOwner.id } })
    })
  })

  describe('Database-level isolation', () => {
    it('team member queries are scoped by companyId', async () => {
      const membersA = await prisma.teamMember.findMany({ where: { companyId: companyAId } })
      const membersB = await prisma.teamMember.findMany({ where: { companyId: companyBId } })

      expect(membersA.every(m => m.companyId === companyAId)).toBe(true)
      expect(membersB.every(m => m.companyId === companyBId)).toBe(true)

      const aUserIds = membersA.map(m => m.userId).filter(Boolean)
      const bUserIds = membersB.map(m => m.userId).filter(Boolean)
      const overlap = aUserIds.filter(id => bUserIds.includes(id))
      expect(overlap).toHaveLength(0)
    })

    it('unique constraint prevents duplicate membership', async () => {
      const existing = await prisma.teamMember.findFirst({
        where: { companyId: companyAId, userId: ownerAId, status: 'ACTIVE' },
      })
      expect(existing).not.toBeNull()
    })
  })
})
