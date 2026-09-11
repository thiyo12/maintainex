import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createCompanyInvite, acceptCompanyInvite } from '@/lib/phase6/invitation'
import { requiresPostgres } from '../test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.2 — Invitation Concurrency', () => {
  let companyId: string
  let ownerUserId: string
  let inviteToken: string

  beforeAll(async () => {
    const ts = Date.now()
    const owner = await prisma.user.create({
      data: { email: `invite-concurrency-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: {
        userId: ownerUserId,
        companyName: `Invite Concurrency Co ${ts}`,
        services: '[]',
        serviceAreas: '[]',
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
    })
    companyId = company.id

    await prisma.teamMember.create({
      data: {
        companyId,
        userId: ownerUserId,
        name: 'Owner',
        role: 'COMPANY_OWNER',
        skills: '[]',
        status: 'ACTIVE',
      },
    })
  })

  afterAll(async () => {
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.teamInvite.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => {})
  })

  it('real concurrent acceptance: exactly one wins', async () => {
    const sharedEmail = `concurrent-invite-${Date.now()}@test.com`
    const invite = await createCompanyInvite({
      companyId,
      inviterUserId: ownerUserId,
      inviterRole: 'COMPANY_OWNER',
      name: 'Concurrent User',
      email: sharedEmail,
      role: 'WORKER',
    })
    expect(invite.success).toBe(true)
    inviteToken = invite.token!

    const users = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.user.create({
          data: { email: `concurrent-acceptor-${Date.now()}-${i}@test.com`, passwordHash: 'hash', name: `User${i}`, role: 'TASKER' },
        })
      )
    )

    const results = await Promise.all(
      users.map((u) =>
        acceptCompanyInvite({
          token: inviteToken,
          userId: u.id,
          userEmail: sharedEmail,
        })
      )
    )

    const successes = results.filter((r) => r.success)
    expect(successes.length).toBe(1)

    const activeMembers = await prisma.teamMember.findMany({
      where: { companyId, status: 'ACTIVE' },
    })
    const newMembers = activeMembers.filter((m) => m.userId !== ownerUserId)
    expect(newMembers.length).toBe(1)

    const inviteAfter = await prisma.teamInvite.findUnique({ where: { token: inviteToken } })
    expect(inviteAfter?.status).toBe('ACCEPTED')

    for (const u of users) {
      await prisma.teamMember.deleteMany({ where: { companyId, userId: u.id } })
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {})
    }
  })

  it('second acceptance after first already accepted returns error', async () => {
    const sharedEmail2 = `sequential-invite-${Date.now()}@test.com`
    const invite2 = await createCompanyInvite({
      companyId,
      inviterUserId: ownerUserId,
      inviterRole: 'COMPANY_OWNER',
      name: 'Sequential User',
      email: sharedEmail2,
      role: 'WORKER',
    })
    expect(invite2.success).toBe(true)

    const user1 = await prisma.user.create({
      data: { email: `seq-user1-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Seq1', role: 'TASKER' },
    })
    const user2 = await prisma.user.create({
      data: { email: `seq-user2-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Seq2', role: 'TASKER' },
    })

    const first = await acceptCompanyInvite({
      token: invite2.token!,
      userId: user1.id,
      userEmail: sharedEmail2,
    })
    expect(first.success).toBe(true)

    const second = await acceptCompanyInvite({
      token: invite2.token!,
      userId: user2.id,
      userEmail: sharedEmail2,
    })
    expect(second.success).toBe(false)

    await prisma.teamMember.deleteMany({ where: { companyId, userId: { in: [user1.id, user2.id] } } })
    await prisma.user.delete({ where: { id: user1.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: user2.id } }).catch(() => {})
  })
})
