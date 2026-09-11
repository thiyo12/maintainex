import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transferOwnership, getCompanyOwnerCount, getUserCompanyRole } from '@/lib/phase6/company-ownership'
import { requiresPostgres } from '../test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.2 — Ownership Transfer Concurrency', () => {
  let companyId: string
  let ownerUserId: string
  let member1Id: string
  let member2Id: string

  beforeAll(async () => {
    const ts = Date.now()
    const owner = await prisma.user.create({
      data: { email: `transfer-concurrency-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: {
        userId: ownerUserId,
        companyName: `Transfer Concurrency Co ${ts}`,
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

    const m1 = await prisma.user.create({
      data: { email: `transfer-member1-${ts}@test.com`, passwordHash: 'hash', name: 'Member1', role: 'TASKER' },
    })
    member1Id = m1.id
    await prisma.teamMember.create({
      data: { companyId, userId: member1Id, name: 'Member1', role: 'WORKER', skills: '[]', status: 'ACTIVE' },
    })

    const m2 = await prisma.user.create({
      data: { email: `transfer-member2-${ts}@test.com`, passwordHash: 'hash', name: 'Member2', role: 'TASKER' },
    })
    member2Id = m2.id
    await prisma.teamMember.create({
      data: { companyId, userId: member2Id, name: 'Member2', role: 'WORKER', skills: '[]', status: 'ACTIVE' },
    })
  })

  afterAll(async () => {
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, member1Id, member2Id] } } }).catch(() => {})
  })

  it('concurrent transfers: exactly one succeeds', async () => {
    const results = await Promise.all([
      transferOwnership(companyId, ownerUserId, member1Id, 'MANAGER'),
      transferOwnership(companyId, ownerUserId, member2Id, 'MANAGER'),
    ])

    const successes = results.filter((r) => r.success)
    expect(successes.length).toBe(1)

    const ownerCount = await getCompanyOwnerCount(companyId)
    expect(ownerCount).toBe(1)

    const ownerRole = await getUserCompanyRole(companyId, ownerUserId)
    expect(ownerRole).not.toBe('COMPANY_OWNER')
  })

  it('rejects demote to COMPANY_OWNER', async () => {
    const result = await transferOwnership(companyId, ownerUserId, member1Id, 'COMPANY_OWNER')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Demote role cannot be COMPANY_OWNER')
  })

  it('rejects self-transfer', async () => {
    const currentOwner = await prisma.teamMember.findFirst({
      where: { companyId, role: 'COMPANY_OWNER', status: 'ACTIVE' },
    })
    if (currentOwner?.userId) {
      const result = await transferOwnership(companyId, currentOwner.userId, currentOwner.userId)
      expect(result.success).toBe(false)
      expect(result.error).toContain('yourself')
    }
  })
})
