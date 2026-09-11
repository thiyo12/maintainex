import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transferOwnership } from '@/lib/phase6/company-ownership'
import { requiresPostgres } from '../test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.3 — Ownership Transfer Atomicity', () => {
  let companyId: string
  let ownerUserId: string
  let targetUserId: string
  let originalRole: string

  beforeAll(async () => {
    const ts = Date.now()
    const owner = await prisma.user.create({
      data: { email: `own-atomic-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: { userId: ownerUserId, companyName: `Own Atomic Co ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyId = company.id

    await prisma.teamMember.create({
      data: { companyId, userId: ownerUserId, name: 'Owner', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const target = await prisma.user.create({
      data: { email: `own-atomic-target-${ts}@test.com`, passwordHash: 'hash', name: 'Target', role: 'TASKER' },
    })
    targetUserId = target.id
    const member = await prisma.teamMember.create({
      data: { companyId, userId: targetUserId, name: 'Target', role: 'DISPATCHER', skills: '[]', status: 'ACTIVE' },
    })
    originalRole = member.role
  })

  afterAll(async () => {
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, targetUserId] } } }).catch(() => {})
  })

  it('successful transfer: promote target, demote owner', async () => {
    const result = await transferOwnership(companyId, ownerUserId, targetUserId, 'MANAGER')
    expect(result.success).toBe(true)

    const targetMember = await prisma.teamMember.findFirst({ where: { companyId, userId: targetUserId } })
    expect(targetMember?.role).toBe('COMPANY_OWNER')

    const ownerMember = await prisma.teamMember.findFirst({ where: { companyId, userId: ownerUserId } })
    expect(ownerMember?.role).toBe('MANAGER')

    await prisma.$executeRaw`UPDATE "TeamMember" SET "role" = 'COMPANY_OWNER' WHERE "id" = ${ownerMember!.id}`
    await prisma.$executeRaw`UPDATE "TeamMember" SET "role" = ${originalRole} WHERE "id" = ${targetMember!.id}`
  })

  it('concurrent transfer: exactly one succeeds', async () => {
    const r1 = await transferOwnership(companyId, ownerUserId, targetUserId, 'MANAGER')
    if (r1.success) {
      await prisma.$executeRaw`UPDATE "TeamMember" SET "role" = 'COMPANY_OWNER' WHERE "companyId" = ${companyId} AND "userId" = ${ownerUserId}`
      await prisma.$executeRaw`UPDATE "TeamMember" SET "role" = ${originalRole} WHERE "companyId" = ${companyId} AND "userId" = ${targetUserId}`
    }

    const results = await Promise.all([
      transferOwnership(companyId, ownerUserId, targetUserId, 'MANAGER'),
      transferOwnership(companyId, ownerUserId, targetUserId, 'DISPATCHER'),
    ])

    const successes = results.filter((r) => r.success)
    expect(successes.length).toBe(1)

    const ownerAfter = await prisma.teamMember.findFirst({ where: { companyId, userId: ownerUserId } })
    expect(ownerAfter?.role).not.toBe('COMPANY_OWNER')

    await prisma.$executeRaw`UPDATE "TeamMember" SET "role" = 'COMPANY_OWNER' WHERE "companyId" = ${companyId} AND "userId" = ${ownerUserId}`
    await prisma.$executeRaw`UPDATE "TeamMember" SET "role" = ${originalRole} WHERE "companyId" = ${companyId} AND "userId" = ${targetUserId}`
  })

  it('failure leaves zero role changes', async () => {
    const targetBefore = await prisma.teamMember.findFirst({ where: { companyId, userId: targetUserId } })
    const ownerBefore = await prisma.teamMember.findFirst({ where: { companyId, userId: ownerUserId } })

    const result = await transferOwnership(companyId, ownerUserId, ownerUserId, 'MANAGER')
    expect(result.success).toBe(false)

    const targetAfter = await prisma.teamMember.findFirst({ where: { companyId, userId: targetUserId } })
    const ownerAfter = await prisma.teamMember.findFirst({ where: { companyId, userId: ownerUserId } })

    expect(targetAfter?.role).toBe(targetBefore?.role)
    expect(ownerAfter?.role).toBe(ownerBefore?.role)
  })
})
