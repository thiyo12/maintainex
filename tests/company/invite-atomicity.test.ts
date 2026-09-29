import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { acceptCompanyInvite } from '@/lib/phase6/invitation'
import { requiresPostgres } from '../helpers/test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.3 — Invitation Acceptance Atomicity', () => {
  let companyId: string
  let ownerUserId: string

  beforeAll(async () => {
    const ts = Date.now()
    const owner = await prisma.user.create({
      data: { email: `invite-atomic-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: { userId: ownerUserId, companyName: `Invite Atomic Co ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyId = company.id

    await prisma.teamMember.create({
      data: { companyId, userId: ownerUserId, name: 'Owner', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })
  })

  afterAll(async () => {
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.teamInvite.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => {})
  })

  it('failed invite acceptance leaves invite PENDING and no membership', async () => {
    const invite = await prisma.teamInvite.create({
      data: {
        companyId,
        name: 'Rollback User',
        email: 'rollback@test.com',
        role: 'WORKER',
        token: `rollback-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
        invitedBy: ownerUserId,
        status: 'PENDING',
      },
    })

    const user = await prisma.user.create({
      data: { email: `rollback-user-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Rollback', role: 'TASKER' },
    })

    const result = await acceptCompanyInvite({
      token: `wrong-token-${Date.now()}`,
      userId: user.id,
      userEmail: 'rollback@test.com',
    })

    expect(result.success).toBe(false)

    const inviteAfter = await prisma.teamMember.findFirst({ where: { companyId, userId: user.id } })
    expect(inviteAfter).toBeNull()

    await prisma.teamInvite.delete({ where: { id: invite.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  })

  it('5-way concurrent acceptance: exactly one wins', async () => {
    const sharedEmail = `concurrent-atomic-${Date.now()}@test.com`
    const invite = await prisma.teamInvite.create({
      data: {
        companyId,
        name: 'Concurrent User',
        email: sharedEmail,
        role: 'WORKER',
        token: `concurrent-atomic-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
        invitedBy: ownerUserId,
        status: 'PENDING',
      },
    })

    const users = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.user.create({
          data: { email: `concurrent-atomic-user-${Date.now()}-${i}@test.com`, passwordHash: 'hash', name: `CU${i}`, role: 'TASKER' },
        })
      )
    )

    const results = await Promise.all(
      users.map((u) =>
        acceptCompanyInvite({ token: invite.token, userId: u.id, userEmail: sharedEmail })
      )
    )

    const successes = results.filter((r) => r.success)
    expect(successes.length).toBe(1)

    const members = await prisma.teamMember.findMany({ where: { companyId, status: 'ACTIVE' } })
    const newMembers = members.filter((m) => m.userId !== ownerUserId)
    expect(newMembers.length).toBe(1)

    const inviteAfter = await prisma.teamInvite.findUnique({ where: { id: invite.id } })
    expect(inviteAfter?.status).toBe('ACCEPTED')

    for (const u of users) {
      await prisma.teamMember.deleteMany({ where: { companyId, userId: u.id } })
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {})
    }
    await prisma.teamInvite.delete({ where: { id: invite.id } }).catch(() => {})
  })

  it('invite + membership created atomically: either both or neither', async () => {
    const invite = await prisma.teamInvite.create({
      data: {
        companyId,
        name: 'Atomic User',
        email: 'atomic@test.com',
        role: 'WORKER',
        token: `atomic-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
        invitedBy: ownerUserId,
        status: 'PENDING',
      },
    })

    const user = await prisma.user.create({
      data: { email: `atomic-user-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Atomic', role: 'TASKER' },
    })

    const result = await acceptCompanyInvite({ token: invite.token, userId: user.id, userEmail: 'atomic@test.com' })
    expect(result.success).toBe(true)

    const inviteAfter = await prisma.teamInvite.findUnique({ where: { id: invite.id } })
    expect(inviteAfter?.status).toBe('ACCEPTED')

    const member = await prisma.teamMember.findFirst({ where: { companyId, userId: user.id, status: 'ACTIVE' } })
    expect(member).toBeTruthy()

    await prisma.teamMember.deleteMany({ where: { companyId, userId: user.id } })
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
    await prisma.teamInvite.delete({ where: { id: invite.id } }).catch(() => {})
  })
})
