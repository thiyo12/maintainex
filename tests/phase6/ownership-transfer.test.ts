import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transferOwnership, getCompanyOwnerCount, isLastOwner, getUserCompanyRole } from '@/lib/phase6/company-ownership'

const prisma = new PrismaClient()

describe('Phase 6.1 — Ownership Transfer', () => {
  let companyId: string
  let ownerUserId: string
  let newOwnerUserId: string
  let managerUserId: string

  beforeAll(async () => {
    const ts = Date.now()
    const owner = await prisma.user.create({
      data: { email: `transfer-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: {
        userId: ownerUserId,
        companyName: `Transfer Test Co ${ts}`,
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

    const newOwner = await prisma.user.create({
      data: { email: `transfer-newowner-${ts}@test.com`, passwordHash: 'hash', name: 'NewOwner', role: 'TASKER' },
    })
    newOwnerUserId = newOwner.id

    await prisma.teamMember.create({
      data: {
        companyId,
        userId: newOwnerUserId,
        name: 'NewOwner',
        role: 'WORKER',
        skills: '[]',
        status: 'ACTIVE',
      },
    })

    const manager = await prisma.user.create({
      data: { email: `transfer-manager-${ts}@test.com`, passwordHash: 'hash', name: 'Manager', role: 'TASKER' },
    })
    managerUserId = manager.id

    await prisma.teamMember.create({
      data: {
        companyId,
        userId: managerUserId,
        name: 'Manager',
        role: 'MANAGER',
        skills: '[]',
        status: 'ACTIVE',
      },
    })
  })

  afterAll(async () => {
    if (managerUserId) await prisma.teamMember.deleteMany({ where: { companyId, userId: managerUserId } })
    if (managerUserId) await prisma.user.delete({ where: { id: managerUserId } }).catch(() => {})
    if (newOwnerUserId) await prisma.teamMember.deleteMany({ where: { companyId, userId: newOwnerUserId } })
    if (newOwnerUserId) await prisma.user.delete({ where: { id: newOwnerUserId } }).catch(() => {})
    if (ownerUserId) await prisma.teamMember.deleteMany({ where: { companyId, userId: ownerUserId } })
    if (ownerUserId) await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => {})
    if (companyId) await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('promotes new owner and demotes previous owner', async () => {
    const result = await transferOwnership(companyId, ownerUserId, newOwnerUserId, 'MANAGER')
    expect(result.success).toBe(true)

    const ownerCount = await getCompanyOwnerCount(companyId)
    expect(ownerCount).toBe(1)

    const oldRole = await getUserCompanyRole(companyId, ownerUserId)
    expect(oldRole).toBe('MANAGER')

    const newRole = await getUserCompanyRole(companyId, newOwnerUserId)
    expect(newRole).toBe('COMPANY_OWNER')
  })

  it('rejects transfer to self', async () => {
    const result = await transferOwnership(companyId, newOwnerUserId, newOwnerUserId)
    expect(result.success).toBe(false)
    expect(result.error).toContain('yourself')
  })

  it('rejects transfer by non-owner', async () => {
    const result = await transferOwnership(companyId, managerUserId, ownerUserId)
    expect(result.success).toBe(false)
    expect(result.error).toContain('COMPANY_OWNER')
  })

  it('rejects transfer to non-member', async () => {
    const stranger = await prisma.user.create({
      data: { email: `stranger-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Stranger', role: 'TASKER' },
    })
    const result = await transferOwnership(companyId, newOwnerUserId, stranger.id)
    expect(result.success).toBe(false)
    expect(result.error).toContain('active team member')
    await prisma.user.delete({ where: { id: stranger.id } }).catch(() => {})
  })

  it('active owner count never reaches zero', async () => {
    const count = await getCompanyOwnerCount(companyId)
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
