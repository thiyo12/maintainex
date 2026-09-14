import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { reviewCredential, expireCredentialsByHolder } from '../../lib/domain/credential-review'
import type { AdminSession } from '../../lib/admin-types'

const prisma = new PrismaClient()

const ADMIN_SESSION: AdminSession = {
  id: 'admin-cred-108',
  email: 'admin-cred-108@test.com',
  role: 'SUPER_ADMIN',
  firstName: 'Admin',
  lastName: 'Cred108',
  assignedCountries: ['LK'],
  authType: 'adminUser',
}

let credentialIdPending: string
let credentialIdVerified: string
let holderUserId: string

afterAll(async () => {
  if (credentialIdPending) await prisma.certification.delete({ where: { id: credentialIdPending } }).catch(() => {})
  if (credentialIdVerified) await prisma.certification.delete({ where: { id: credentialIdVerified } }).catch(() => {})
  if (holderUserId) await prisma.user.delete({ where: { id: holderUserId } }).catch(() => {})
})

beforeAll(async () => {
  const user = await prisma.user.upsert({
    where: { email: 'cred-holder-108@phase108.com' },
    update: {},
    create: {
      email: 'cred-holder-108@phase108.com', passwordHash: 'dummy', name: 'Cred Holder',
      phone: '+94772000108', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED',
    },
  })
  holderUserId = user.id

  const credP = await prisma.certification.create({
    data: {
      name: 'Safety Certificate', certificationType: 'SAFETY',
      holderType: 'USER', holderId: holderUserId, verificationStatus: 'PENDING',
      expiryDate: new Date('2027-01-01'),
    },
  })
  credentialIdPending = credP.id

  const credV = await prisma.certification.create({
    data: {
      name: 'Electrical License', certificationType: 'LICENSE',
      holderType: 'USER', holderId: holderUserId, verificationStatus: 'VERIFIED',
      expiryDate: new Date('2027-06-01'),
    },
  })
  credentialIdVerified = credV.id

  await prisma.auditLog.deleteMany({ where: { adminUserId: 'admin-cred-108' } })
})

describe('Phase 10.8 — Credential Review', () => {
  it('approve credential sets VERIFIED and creates audit', async () => {
    const result = await reviewCredential(prisma, {
      credentialId: credentialIdPending,
      status: 'VERIFIED',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('VERIFIED')

    const cred = await prisma.certification.findUnique({ where: { id: credentialIdPending } })
    expect(cred!.verificationStatus).toBe('VERIFIED')

    const audit = await prisma.auditLog.findFirst({
      where: { adminUserId: 'admin-cred-108', targetId: credentialIdPending, action: 'CREDENTIAL_APPROVE' },
    })
    expect(audit).not.toBeNull()
  })

  it('reject credential requires reason', async () => {
    const rejectCred = await prisma.certification.create({
      data: {
        name: 'Fake Cert', certificationType: 'OTHER',
        holderType: 'USER', holderId: holderUserId, verificationStatus: 'PENDING',
      },
    })

    await expect(
      reviewCredential(prisma, {
        credentialId: rejectCred.id,
        status: 'REJECTED',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('Rejection reason')

    await prisma.certification.delete({ where: { id: rejectCred.id } })
  })

  it('reject credential with reason succeeds', async () => {
    const rejectCred = await prisma.certification.create({
      data: {
        name: 'Fake Cert 2', certificationType: 'OTHER',
        holderType: 'USER', holderId: holderUserId, verificationStatus: 'PENDING',
      },
    })

    const result = await reviewCredential(prisma, {
      credentialId: rejectCred.id,
      status: 'REJECTED',
      reason: 'Document appears forged',
      session: ADMIN_SESSION,
      ipAddress: '127.0.0.1',
    })

    expect(result.success).toBe(true)
    expect(result.newStatus).toBe('REJECTED')

    const audit = await prisma.auditLog.findFirst({
      where: { adminUserId: 'admin-cred-108', targetId: rejectCred.id, action: 'CREDENTIAL_REJECT' },
    })
    expect(audit).not.toBeNull()

    await prisma.certification.delete({ where: { id: rejectCred.id } })
  })

  it('review rejects already terminal credential', async () => {
    await expect(
      reviewCredential(prisma, {
        credentialId: credentialIdPending,
        status: 'VERIFIED',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('terminal state')
  })

  it('review rejects non-existent credential', async () => {
    await expect(
      reviewCredential(prisma, {
        credentialId: 'non-existent-id',
        status: 'VERIFIED',
        session: ADMIN_SESSION,
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow('not found')
  })
})

describe('Phase 10.8 — Bulk Credential Expiry', () => {
  it('expireCredentialsByHolder expires expired credentials', async () => {
    const expiredCred = await prisma.certification.create({
      data: {
        name: 'Expired Cert', certificationType: 'LICENSE',
        holderType: 'USER', holderId: holderUserId, verificationStatus: 'VERIFIED',
        expiryDate: new Date('2020-01-01'),
      },
    })

    const result = await expireCredentialsByHolder(
      prisma, 'USER', holderUserId, ADMIN_SESSION, '127.0.0.1'
    )

    expect(result.expiredCount).toBeGreaterThanOrEqual(1)

    const cred = await prisma.certification.findUnique({ where: { id: expiredCred.id } })
    expect(cred!.verificationStatus).toBe('EXPIRED')

    await prisma.certification.delete({ where: { id: expiredCred.id } })
  })
})
