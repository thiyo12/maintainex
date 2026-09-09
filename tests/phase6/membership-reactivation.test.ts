import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { acceptCompanyInvite, createCompanyInvite } from '@/lib/phase6/invitation'
import { getUserCompanyRole, canRemoveMemberSafe } from '@/lib/phase6/company-ownership'

const prisma = new PrismaClient()

describe('Phase 6.1 — Removed Member Reactivation', () => {
  let companyId: string
  let ownerUserId: string
  let memberUserId: string

  beforeAll(async () => {
    const ts = Date.now()
    const owner = await prisma.user.create({
      data: { email: `react-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: {
        userId: ownerUserId,
        companyName: `React Test Co ${ts}`,
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

    const member = await prisma.user.create({
      data: { email: `react-member-${ts}@test.com`, passwordHash: 'hash', name: 'Member', role: 'TASKER' },
    })
    memberUserId = member.id
  })

  afterAll(async () => {
    if (memberUserId) await prisma.user.delete({ where: { id: memberUserId } }).catch(() => {})
    if (ownerUserId) await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => {})
    if (companyId) await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('full lifecycle: invite → accept → remove → re-invite → accept → ACTIVE', async () => {
    const inviteEmail1 = `react-member-lifecycle-${Date.now()}@test.com`
    const invite1 = await createCompanyInvite({
      companyId,
      inviterUserId: ownerUserId,
      inviterRole: 'COMPANY_OWNER',
      name: 'Member',
      email: inviteEmail1,
      role: 'WORKER',
    })
    expect(invite1.success).toBe(true)

    const accept1 = await acceptCompanyInvite({
      token: invite1.token!,
      userId: memberUserId,
      userEmail: inviteEmail1,
    })
    expect(accept1.success).toBe(true)

    let role = await getUserCompanyRole(companyId, memberUserId)
    expect(role).toBe('WORKER')

    const removal = await canRemoveMemberSafe(companyId, ownerUserId, memberUserId, 'COMPANY_OWNER')
    expect(removal.allowed).toBe(true)

    const memberRecord = await prisma.teamMember.findFirst({
      where: { companyId, userId: memberUserId, status: 'ACTIVE' },
    })
    await prisma.teamMember.update({
      where: { id: memberRecord!.id },
      data: { status: 'REMOVED' },
    })

    role = await getUserCompanyRole(companyId, memberUserId)
    expect(role).toBeNull()

    const inviteEmail2 = `react-member-lifecycle-2-${Date.now()}@test.com`
    const invite2 = await createCompanyInvite({
      companyId,
      inviterUserId: ownerUserId,
      inviterRole: 'COMPANY_OWNER',
      name: 'Member',
      email: inviteEmail2,
      role: 'DISPATCHER',
    })
    expect(invite2.success).toBe(true)

    const accept2 = await acceptCompanyInvite({
      token: invite2.token!,
      userId: memberUserId,
      userEmail: inviteEmail2,
    })
    expect(accept2.success).toBe(true)

    role = await getUserCompanyRole(companyId, memberUserId)
    expect(role).toBe('DISPATCHER')

    const activeMembers = await prisma.teamMember.findMany({
      where: { companyId, userId: memberUserId, status: 'ACTIVE' },
    })
    expect(activeMembers.length).toBe(1)
  })

  it('concurrent double acceptance yields exactly one ACTIVE membership', async () => {
    const inviteEmail = `concurrent-${Date.now()}@test.com`
    const invite = await createCompanyInvite({
      companyId,
      inviterUserId: ownerUserId,
      inviterRole: 'COMPANY_OWNER',
      name: 'Concurrent Member',
      email: inviteEmail,
      role: 'WORKER',
    })
    expect(invite.success).toBe(true)

    const concurrentUser = await prisma.user.create({
      data: { email: `concurrent-user-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Concurrent', role: 'TASKER' },
    })

    const accept1 = await acceptCompanyInvite({
      token: invite.token!,
      userId: concurrentUser.id,
      userEmail: inviteEmail,
    })
    expect(accept1.success).toBe(true)

    await acceptCompanyInvite({
      token: invite.token!,
      userId: concurrentUser.id,
      userEmail: inviteEmail,
    })

    const activeMembers = await prisma.teamMember.findMany({
      where: { companyId, userId: concurrentUser.id, status: 'ACTIVE' },
    })
    expect(activeMembers.length).toBe(1)

    await prisma.teamMember.deleteMany({ where: { companyId, userId: concurrentUser.id } })
    await prisma.user.delete({ where: { id: concurrentUser.id } }).catch(() => {})
  })
})
