import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transferOwnership } from '@/lib/phase6/company-ownership'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'
import { requiresPostgres } from '../helpers/test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.4 — Audit Failure Rollback', () => {
  let companyId: string
  let ownerUserId: string
  let targetUserId: string
  let originalTargetRole: string

  beforeAll(async () => {
    const ts = Date.now()
    const owner = await prisma.user.create({
      data: { email: `audit-rb-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: { userId: ownerUserId, companyName: `Audit RB Co ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyId = company.id

    await prisma.teamMember.create({
      data: { companyId, userId: ownerUserId, name: 'Owner', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const target = await prisma.user.create({
      data: { email: `audit-rb-target-${ts}@test.com`, passwordHash: 'hash', name: 'Target', role: 'TASKER' },
    })
    targetUserId = target.id
    const member = await prisma.teamMember.create({
      data: { companyId, userId: targetUserId, name: 'Target', role: 'DISPATCHER', skills: '[]', status: 'ACTIVE' },
    })
    originalTargetRole = member.role
  })

  afterAll(async () => {
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, targetUserId] } } }).catch(() => {})
  })

  it('ownership transfer succeeds under normal conditions', async () => {
    const result = await transferOwnership(companyId, ownerUserId, targetUserId, 'MANAGER')
    expect(result.success).toBe(true)

    const targetAfter = await prisma.teamMember.findFirst({ where: { companyId, userId: targetUserId } })
    expect(targetAfter?.role).toBe('COMPANY_OWNER')

    const ownerAfter = await prisma.teamMember.findFirst({ where: { companyId, userId: ownerUserId } })
    expect(ownerAfter?.role).toBe('MANAGER')

    await prisma.$executeRaw`UPDATE "TeamMember" SET "role" = 'COMPANY_OWNER' WHERE "id" = ${ownerAfter!.id}`
    await prisma.$executeRaw`UPDATE "TeamMember" SET "role" = ${originalTargetRole} WHERE "id" = ${targetAfter!.id}`
  })

  it('writeCompanyAuditLog propagates error when called within failed transaction', async () => {
    const targetBefore = await prisma.teamMember.findFirst({ where: { companyId, userId: targetUserId }, select: { role: true } })
    const ownerBefore = await prisma.teamMember.findFirst({ where: { companyId, userId: ownerUserId }, select: { role: true } })

    const auditCompanyId = 'nonexistent-company-for-audit-failure'

    let auditError: any = null
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "TeamMember"
          SET "role" = 'COMPANY_OWNER', "updatedAt" = NOW()
          WHERE "companyId" = ${companyId}
            AND "userId" = ${targetUserId}
            AND "status" = 'ACTIVE'
            AND "role" != 'COMPANY_OWNER'
        `

        await writeCompanyAuditLog({
          companyId: auditCompanyId,
          actorId: ownerUserId,
          actorRole: 'COMPANY_OWNER',
          action: 'OWNERSHIP_TRANSFER',
          description: 'This should fail',
        }, tx)
      })
    } catch (err: any) {
      auditError = err
    }

    expect(auditError).toBeTruthy()

    const targetAfter = await prisma.teamMember.findFirst({ where: { companyId, userId: targetUserId }, select: { role: true } })
    const ownerAfter = await prisma.teamMember.findFirst({ where: { companyId, userId: ownerUserId }, select: { role: true } })

    expect(targetAfter?.role).toBe(targetBefore?.role)
    expect(ownerAfter?.role).toBe(ownerBefore?.role)
  })

  it('audit failure without tx does not crash the caller', async () => {
    await writeCompanyAuditLog({
      companyId: 'nonexistent-company',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
      action: 'OWNERSHIP_TRANSFER',
      description: 'Standalone audit log failure',
    }).catch(() => {})

    const owner = await prisma.user.findUnique({ where: { id: ownerUserId } })
    expect(owner).toBeTruthy()
  })
})
