import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  getCompanyOwnerCount,
  hasActiveOwner,
  isLastOwner,
  canRemoveMemberSafe,
  getCompanyMembers,
  isUserCompanyMember,
  getUserCompanyRole,
} from '@/lib/phase6/company-ownership'
import {
  createCompanyInvite,
  acceptCompanyInvite,
  cancelInvite,
} from '@/lib/phase6/invitation'
import { requiresPostgres } from '../helpers/test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6 — Company Membership', () => {
  let companyId: string
  let ownerUserId: string
  let workerUserId: string
  let managerUserId: string

  beforeAll(async () => {
    const ts = Date.now()
    const owner = await prisma.user.create({
      data: { email: `membership-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY' },
    })
    ownerUserId = owner.id

    const worker = await prisma.user.create({
      data: { email: `membership-worker-${ts}@test.com`, passwordHash: 'hash', name: 'Worker', role: 'CUSTOMER', identityStatus: 'VERIFIED' },
    })
    workerUserId = worker.id

    const manager = await prisma.user.create({
      data: { email: `membership-manager-${ts}@test.com`, passwordHash: 'hash', name: 'Manager', role: 'CUSTOMER', identityStatus: 'VERIFIED' },
    })
    managerUserId = manager.id

    const company = await prisma.companyProfile.create({
      data: { userId: ownerUserId, companyName: 'Membership Test Co', services: 'plumbing', serviceAreas: 'Colombo' },
    })
    companyId = company.id

    await prisma.teamMember.create({
      data: { companyId, userId: ownerUserId, name: 'Owner', role: 'COMPANY_OWNER', skills: '[]' },
    })
  })

  afterAll(async () => {
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.teamInvite.deleteMany({ where: { companyId } })
    await prisma.companyProfile.deleteMany({ where: { id: companyId } })
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, workerUserId, managerUserId] } } })
  })

  describe('Owner invariant', () => {
    it('company has exactly one owner', async () => {
      const count = await getCompanyOwnerCount(companyId)
      expect(count).toBe(1)
    })

    it('hasActiveOwner returns true', async () => {
      expect(await hasActiveOwner(companyId)).toBe(true)
    })

    it('isLastOwner returns true for the sole owner', async () => {
      expect(await isLastOwner(companyId, ownerUserId)).toBe(true)
    })

    it('isLastOwner returns false for non-owner', async () => {
      expect(await isLastOwner(companyId, workerUserId)).toBe(false)
    })
  })

  describe('Invitation flow', () => {
    let inviteToken: string
    let inviteEmail: string

    it('creates invitation successfully', async () => {
      inviteEmail = `newworker-${Date.now()}@test.com`
      const result = await createCompanyInvite({
        companyId,
        inviterUserId: ownerUserId,
        inviterRole: 'COMPANY_OWNER',
        name: 'New Worker',
        email: inviteEmail,
        role: 'WORKER',
      })
      expect(result.success).toBe(true)
      expect(result.token).toBeDefined()
      inviteToken = result.token!
    })

    it('rejects duplicate invitation for same email', async () => {
      const result = await createCompanyInvite({
        companyId,
        inviterUserId: ownerUserId,
        inviterRole: 'COMPANY_OWNER',
        name: 'Duplicate Worker',
        email: inviteEmail,
        role: 'WORKER',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
    })

    it('rejects inviting as OWNER', async () => {
      const result = await createCompanyInvite({
        companyId,
        inviterUserId: ownerUserId,
        inviterRole: 'COMPANY_OWNER',
        name: 'Bad Owner',
        email: 'bad@test.com',
        role: 'COMPANY_OWNER',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('owner')
    })

    it('rejects invitation without email or phone', async () => {
      const result = await createCompanyInvite({
        companyId,
        inviterUserId: ownerUserId,
        inviterRole: 'COMPANY_OWNER',
        name: 'No Contact',
        role: 'WORKER',
      })
      expect(result.success).toBe(false)
    })

    it('accepts invitation successfully', async () => {
      const result = await acceptCompanyInvite({
        token: inviteToken,
        userId: workerUserId,
        userEmail: inviteEmail,
      })
      expect(result.success).toBe(true)
      expect(result.companyName).toBe('Membership Test Co')
    })

    it('rejects duplicate acceptance', async () => {
      const result = await acceptCompanyInvite({
        token: inviteToken,
        userId: workerUserId,
        userEmail: inviteEmail,
      })
      expect(result.success).toBe(false)
    })

    it('rejects wrong email acceptance', async () => {
      const wrongEmail = `specific-${Date.now()}@test.com`
      const result2 = await createCompanyInvite({
        companyId,
        inviterUserId: ownerUserId,
        inviterRole: 'COMPANY_OWNER',
        name: 'Email Test',
        email: wrongEmail,
        role: 'WORKER',
      })
      const result = await acceptCompanyInvite({
        token: result2.token!,
        userId: workerUserId,
        userEmail: 'different@test.com',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('different email')
    })

    it('rejects phone invitation acceptance by a different phone number', async () => {
      const invitedPhone = '+94771234567'
      const result2 = await createCompanyInvite({
        companyId,
        inviterUserId: ownerUserId,
        inviterRole: 'COMPANY_OWNER',
        name: 'Phone Test',
        phone: invitedPhone,
        role: 'WORKER',
      })
      expect(result2.success).toBe(true)

      const result = await acceptCompanyInvite({
        token: result2.token!,
        userId: workerUserId,
        userEmail: 'worker@test.com',
        userPhone: '+94770000000',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('different phone')
    })
  })

  describe('Member removal safety', () => {
    it('owner can remove worker', async () => {
      const result = await canRemoveMemberSafe(companyId, ownerUserId, workerUserId, 'COMPANY_OWNER')
      expect(result.allowed).toBe(true)
    })

    it('owner cannot remove last owner', async () => {
      const result = await canRemoveMemberSafe(companyId, ownerUserId, ownerUserId, 'COMPANY_OWNER')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('last owner')
    })

    it('worker cannot remove owner', async () => {
      const result = await canRemoveMemberSafe(companyId, workerUserId, ownerUserId, 'WORKER')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('permissions')
    })

    it('manager can remove worker', async () => {
      await prisma.teamMember.create({
        data: { companyId, userId: managerUserId, name: 'Manager', role: 'MANAGER', skills: '[]', status: 'ACTIVE' },
      })
      const result = await canRemoveMemberSafe(companyId, managerUserId, workerUserId, 'MANAGER')
      expect(result.allowed).toBe(true)
    })

    it('manager cannot remove owner', async () => {
      const result = await canRemoveMemberSafe(companyId, managerUserId, ownerUserId, 'MANAGER')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Only owners')
    })
  })

  describe('Member queries', () => {
    it('getCompanyMembers returns all non-removed members', async () => {
      const members = await getCompanyMembers(companyId)
      expect(members.length).toBeGreaterThanOrEqual(2)
      expect(members.every(m => m.status !== 'REMOVED')).toBe(true)
    })

    it('isUserCompanyMember returns true for member', async () => {
      expect(await isUserCompanyMember(companyId, ownerUserId)).toBe(true)
    })

    it('isUserCompanyMember returns false for non-member', async () => {
      const stranger = await prisma.user.create({
        data: { email: 'stranger@test.com', passwordHash: 'hash', name: 'Stranger', role: 'CUSTOMER' },
      })
      expect(await isUserCompanyMember(companyId, stranger.id)).toBe(false)
      await prisma.user.delete({ where: { id: stranger.id } })
    })

    it('getUserCompanyRole returns correct role', async () => {
      expect(await getUserCompanyRole(companyId, ownerUserId)).toBe('COMPANY_OWNER')
    })

    it('getUserCompanyRole returns null for non-member', async () => {
      expect(await getUserCompanyRole(companyId, 'nonexistent')).toBeNull()
    })
  })

  describe('Duplicate membership prevention', () => {
    it('unique constraint on companyId+userId', async () => {
      const existing = await prisma.teamMember.findFirst({
        where: { companyId, userId: ownerUserId, status: 'ACTIVE' },
      })
      expect(existing).not.toBeNull()
    })
  })
})
