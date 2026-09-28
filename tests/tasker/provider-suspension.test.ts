import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  suspendUser,
  reactivateUser,
  suspendCompany,
  reactivateCompany,
  isUserSuspended,
} from '../../lib/domain/admin-suspension'
import type { AdminSession } from '../../lib/admin-types'

const prisma = new PrismaClient()

const ADMIN_SESSION: AdminSession = {
  id: 'admin-108',
  email: 'admin108@test.com',
  role: 'SUPER_ADMIN',
  firstName: 'Admin',
  lastName: '108',
  assignedCountries: ['LK'],
  authType: 'adminUser',
}

let userIdA: string
let userIdB: string
let companyIdA: string

const cleanupIds: { table: string; id: string }[] = []

afterAll(async () => {
  for (const { table, id } of cleanupIds.reverse()) {
    try {
      await (prisma as any)[table].delete({ where: { id } })
    } catch { /* ignore */ }
  }
})

beforeAll(async () => {
  const userA = await prisma.user.upsert({
    where: { email: 'suspend-target-a@phase108.com' },
    update: { isSuspended: false, suspensionReason: null, suspendedUntil: null },
    create: {
      email: 'suspend-target-a@phase108.com', passwordHash: 'dummy', name: 'Suspend A',
      phone: '+94771000108', role: 'CUSTOMER', countryCode: 'LK', identityStatus: 'VERIFIED',
    },
  })
  userIdA = userA.id

  const userB = await prisma.user.upsert({
    where: { email: 'suspend-target-b@phase108.com' },
    update: { isSuspended: false, suspensionReason: null, suspendedUntil: null },
    create: {
      email: 'suspend-target-b@phase108.com', passwordHash: 'dummy', name: 'Suspend B',
      phone: '+94771000109', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED',
    },
  })
  userIdB = userB.id

  const companyA = await prisma.companyProfile.create({
    data: {
      userId: userIdA, companyName: 'Phase108 Corp A', countryCode: 'LK',
      registrationNo: 'REG108A', verificationStatus: 'VERIFIED',
      services: '["electrical"]', serviceAreas: '["colombo"]',
    },
  })
  companyIdA = companyA.id
  cleanupIds.push({ table: 'companyProfile', id: companyIdA })

  await prisma.auditLog.deleteMany({ where: { adminUserId: 'admin-108' } })
})

describe('Phase 10.8 — User Suspension', () => {
  it('suspendUser sets isSuspended=true and creates audit log', async () => {
    const result = await suspendUser(prisma, {
      userId: userIdA,
      reason: 'Repeated policy violation',
      scope: 'ALL',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.user.isSuspended).toBe(true)

    const audit = await prisma.auditLog.findFirst({
      where: { adminUserId: 'admin-108', targetId: userIdA, action: 'PROVIDER_SUSPEND' },
    })
    expect(audit).not.toBeNull()
    expect(audit!.action).toBe('PROVIDER_SUSPEND')
  })

  it('suspendUser rejects if already suspended', async () => {
    await expect(
      suspendUser(prisma, {
        userId: userIdA,
        reason: 'Already suspended',
        scope: 'ALL',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('already suspended')
  })

  it('suspendUser rejects if user not found', async () => {
    await expect(
      suspendUser(prisma, {
        userId: 'non-existent-id',
        reason: 'Test',
        scope: 'ALL',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('not found')
  })

  it('suspendUser rejects if reason too short', async () => {
    await expect(
      suspendUser(prisma, {
        userId: userIdB,
        reason: 'ab',
        scope: 'ALL',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('required')
  })

  it('reactivateUser restores suspended user', async () => {
    const result = await reactivateUser(prisma, {
      userId: userIdA,
      reason: 'Appeal approved',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.user.isSuspended).toBe(false)

    const audit = await prisma.auditLog.findFirst({
      where: { adminUserId: 'admin-108', targetId: userIdA, action: 'PROVIDER_REACTIVATE' },
    })
    expect(audit).not.toBeNull()
  })

  it('reactivateUser rejects if not suspended', async () => {
    await expect(
      reactivateUser(prisma, {
        userId: userIdA,
        reason: 'Test',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('not suspended')
  })

  it('isUserSuspended returns correct state', async () => {
    const suspended = await isUserSuspended(prisma, userIdB)
    expect(suspended).toBe(false)

    await suspendUser(prisma, {
      userId: userIdB,
      reason: 'Temporary block',
      scope: 'MARKETPLACE',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    const afterSuspend = await isUserSuspended(prisma, userIdB)
    expect(afterSuspend).toBe(true)

    await reactivateUser(prisma, {
      userId: userIdB,
      reason: 'Restored',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    const afterReactivate = await isUserSuspended(prisma, userIdB)
    expect(afterReactivate).toBe(false)
  })
})

describe('Phase 10.8 — Company Suspension', () => {
  it('suspendCompany sets status and creates audit', async () => {
    const result = await suspendCompany(prisma, {
      companyProfileId: companyIdA,
      reason: 'Fraud investigation',
      scope: 'ALL',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyIdA } })
    expect(company!.verificationStatus).toBe('SUSPENDED')
  })

  it('suspendCompany rejects if already suspended', async () => {
    await expect(
      suspendCompany(prisma, {
        companyProfileId: companyIdA,
        reason: 'Double suspend',
        scope: 'ALL',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('already suspended')
  })

  it('reactivateCompany restores suspended company', async () => {
    const result = await reactivateCompany(prisma, {
      companyProfileId: companyIdA,
      reason: 'Investigation cleared',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyIdA } })
    expect(company!.verificationStatus).toBe('VERIFIED')
  })

  it('reactivateCompany rejects if not suspended', async () => {
    await expect(
      reactivateCompany(prisma, {
        companyProfileId: companyIdA,
        reason: 'Test',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('not suspended')
  })
})
