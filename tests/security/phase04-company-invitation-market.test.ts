import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { acceptCompanyInvite } from '@/lib/phase6/invitation'
import { requiresPostgres } from '../helpers/test-guard'

const db = new PrismaClient()
const unique = String(Date.now()) + '-' + String(Math.floor(Math.random() * 1000000))
let companyId: string
let ownerId: string
let userCounter = 0

async function inviteWorker(userId: string, email: string) {
  return db.teamInvite.create({
    data: {
      companyId,
      name: 'Phase 04 worker',
      email,
      role: 'WORKER',
      token: 'phase04-team-' + unique + '-' + userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      invitedBy: ownerId,
    },
  })
}

async function createWorker(countryCode: 'LK' | 'CA', values: { isActive?: boolean; isSuspended?: boolean; isBanned?: boolean } = {}) {
  userCounter++
  return db.user.create({
    data: {
      email: 'phase04-' + unique + '-' + countryCode + '-' + userCounter + '@test.local',
      passwordHash: 'test-only',
      name: 'Invite worker',
      role: 'TASKER',
      countryCode,
      ...values,
    },
  })
}

describe.skipIf(!requiresPostgres())('Phase 04 — company invitation market and membership guards (PostgreSQL)', () => {
  beforeAll(async () => {
    const owner = await db.user.create({
      data: {
        email: 'phase04-owner-' + unique + '@test.local',
        passwordHash: 'test-only',
        name: 'Phase 04 company owner',
        role: 'COMPANY',
        countryCode: 'LK',
      },
    })
    ownerId = owner.id
    const company = await db.companyProfile.create({
      data: {
        userId: ownerId,
        companyName: 'Phase 04 invitations ' + unique,
        countryCode: 'LK',
        services: '["plumbing"]',
        serviceAreas: '["Colombo"]',
        verificationStatus: 'VERIFIED',
        isVerified: true,
      },
    })
    companyId = company.id
  })

  afterAll(async () => {
    if (companyId) {
      await db.teamMember.deleteMany({ where: { companyId } })
      await db.teamInvite.deleteMany({ where: { companyId } })
      await db.companyProfile.deleteMany({ where: { id: companyId } })
    }
    await db.user.deleteMany({
      where: { email: { startsWith: 'phase04-' + unique + '-' } },
    })
    if (ownerId) await db.user.delete({ where: { id: ownerId } })
    await db.$disconnect()
  })

  it('refuses a Canadian account joining an LK company without consuming the invitation', async () => {
    const user = await createWorker('CA')
    const invite = await inviteWorker(user.id, user.email)
    const result = await acceptCompanyInvite({ token: invite.token, userId: user.id, userEmail: user.email })
    expect(result.success).toBe(false)
    expect(result.error).toContain('market does not match')
    expect((await db.teamInvite.findUnique({ where: { id: invite.id } }))?.status).toBe('PENDING')
    expect(await db.teamMember.findFirst({ where: { companyId, userId: user.id } })).toBeNull()
  })

  it('blocks a suspended account without consuming the invitation', async () => {
    const user = await createWorker('LK', { isSuspended: true })
    const invite = await inviteWorker(user.id, user.email)
    const result = await acceptCompanyInvite({ token: invite.token, userId: user.id, userEmail: user.email })
    expect(result.success).toBe(false)
    expect(result.error).toContain('unrestricted')
    expect((await db.teamInvite.findUnique({ where: { id: invite.id } }))?.status).toBe('PENDING')
    expect(await db.teamMember.findFirst({ where: { companyId, userId: user.id } })).toBeNull()
  })

  it('blocks an inactive account without consuming the invitation', async () => {
    const user = await createWorker('LK', { isActive: false })
    const invite = await inviteWorker(user.id, user.email)
    const result = await acceptCompanyInvite({ token: invite.token, userId: user.id, userEmail: user.email })
    expect(result.success).toBe(false)
    expect((await db.teamInvite.findUnique({ where: { id: invite.id } }))?.status).toBe('PENDING')
  })

  it('a suspended membership cannot be reactivated by accepting a fresh invitation', async () => {
    const user = await createWorker('LK')
    const member = await db.teamMember.create({
      data: { companyId, userId: user.id, name: user.name, role: 'WORKER', status: 'SUSPENDED', skills: '[]' },
    })
    const invite = await inviteWorker(user.id, user.email)
    const result = await acceptCompanyInvite({ token: invite.token, userId: user.id, userEmail: user.email })
    expect(result.success).toBe(false)
    expect(result.error).toContain('workforce reactivation')
    expect((await db.teamMember.findUnique({ where: { id: member.id } }))?.status).toBe('SUSPENDED')
    expect((await db.teamInvite.findUnique({ where: { id: invite.id } }))?.status).toBe('PENDING')
  })

  it('allows an eligible same-market worker to join normally', async () => {
    const user = await createWorker('LK')
    const invite = await inviteWorker(user.id, user.email)
    const result = await acceptCompanyInvite({ token: invite.token, userId: user.id, userEmail: user.email })
    expect(result.success).toBe(true)
    expect((await db.teamInvite.findUnique({ where: { id: invite.id } }))?.status).toBe('ACCEPTED')
    const member = await db.teamMember.findFirst({ where: { companyId, userId: user.id } })
    expect(member?.status).toBe('ACTIVE')
    expect(member?.role).toBe('WORKER')
  })
})
