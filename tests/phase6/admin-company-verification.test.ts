import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transitionCompanyVerification } from '@/lib/phase6/kyc-writer'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'

const prisma = new PrismaClient()

describe('Phase 6.5 — Admin Company Verification Route', () => {
  let companyId: string
  let ownerUserId: string

  beforeAll(async () => {
    const ts = Date.now()
    const owner = await prisma.user.create({
      data: { email: `admin-verify-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY', identityStatus: 'NOT_SUBMITTED' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: { userId: ownerUserId, companyName: `Admin Verify Co ${ts}`, services: '[]', serviceAreas: '[]', isVerified: false, verificationStatus: 'UNVERIFIED' },
    })
    companyId = company.id

    await prisma.teamMember.create({
      data: { companyId, userId: ownerUserId, name: 'Owner', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })
  })

  afterAll(async () => {
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => {})
  })

  it('transitionCompanyVerification: SUBMIT moves UNVERIFIED -> PENDING', async () => {
    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUBMIT',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(company?.verificationStatus).toBe('PENDING')
  })

  it('transitionCompanyVerification: APPROVE moves PENDING -> VERIFIED', async () => {
    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'APPROVE',
      reviewNote: 'Documents verified by admin',
      reviewedBy: 'admin-user-id',
      actorId: 'admin-user-id',
      actorRole: 'SUPER_ADMIN',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true, isVerified: true } })
    expect(company?.verificationStatus).toBe('VERIFIED')
    expect(company?.isVerified).toBe(true)
  })

  it('transitionCompanyVerification: SUSPEND moves VERIFIED -> SUSPENDED', async () => {
    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUSPEND',
      reviewNote: 'Policy violation',
      reviewedBy: 'admin-user-id',
      actorId: 'admin-user-id',
      actorRole: 'SUPER_ADMIN',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(company?.verificationStatus).toBe('SUSPENDED')
  })

  it('transitionCompanyVerification: SUBMIT moves SUSPENDED -> PENDING (appeal)', async () => {
    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUBMIT',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(company?.verificationStatus).toBe('PENDING')
  })

  it('transitionCompanyVerification: REJECT moves PENDING -> REJECTED', async () => {
    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'REJECT',
      reviewNote: 'Insufficient documentation',
      reviewedBy: 'admin-user-id',
      actorId: 'admin-user-id',
      actorRole: 'SUPER_ADMIN',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(company?.verificationStatus).toBe('REJECTED')
  })

  it('transitionCompanyVerification: SUBMIT moves REJECTED -> PENDING (resubmit)', async () => {
    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUBMIT',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(company?.verificationStatus).toBe('PENDING')
  })

  it('illegal transition: REJECTED -> VERIFIED returns error, zero writes', async () => {
    await transitionCompanyVerification(prisma, {
      companyId,
      action: 'REJECT',
      reviewedBy: 'admin-user-id',
      actorId: 'admin-user-id',
      actorRole: 'SUPER_ADMIN',
    })

    const companyBefore = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })

    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'APPROVE',
      reviewedBy: 'admin-user-id',
      actorId: 'admin-user-id',
      actorRole: 'SUPER_ADMIN',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid company verification transition')

    const companyAfter = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(companyAfter?.verificationStatus).toBe(companyBefore?.verificationStatus)
  })

  it('personal owner KYC approval: company status unchanged', async () => {
    await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUBMIT',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })

    const companyBefore = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })

    const doc = await prisma.identityDocument.create({
      data: { userId: ownerUserId, docType: 'PASSPORT', side: 'FRONT', imageUrl: 'http://test.com/id.jpg', status: 'PENDING' },
    })

    await transitionUserKyc(prisma, { userId: ownerUserId, action: 'SUBMIT', documentId: doc.id })
    await transitionUserKyc(prisma, { userId: ownerUserId, action: 'APPROVE', documentId: doc.id, reviewedBy: 'admin' })

    const user = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { identityStatus: true } })
    expect(user?.identityStatus).toBe('VERIFIED')

    const companyAfter = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(companyAfter?.verificationStatus).toBe(companyBefore?.verificationStatus)

    await prisma.identityDocument.deleteMany({ where: { userId: ownerUserId } })
  })

  it('wrong companyId: returns not found', async () => {
    const result = await transitionCompanyVerification(prisma, {
      companyId: 'nonexistent-company-id',
      action: 'SUBMIT',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Company not found')
  })

  it('VERIFIED → SUSPENDED: isVerified=false', async () => {
    await transitionCompanyVerification(prisma, {
      companyId, action: 'SUBMIT', actorId: ownerUserId, actorRole: 'COMPANY_OWNER',
    })
    await transitionCompanyVerification(prisma, {
      companyId, action: 'APPROVE', reviewedBy: 'admin', actorId: 'admin', actorRole: 'SUPER_ADMIN',
    })

    const verified = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true, isVerified: true } })
    expect(verified?.verificationStatus).toBe('VERIFIED')
    expect(verified?.isVerified).toBe(true)

    await transitionCompanyVerification(prisma, {
      companyId, action: 'SUSPEND', reviewNote: 'violation', reviewedBy: 'admin', actorId: 'admin', actorRole: 'SUPER_ADMIN',
    })

    const suspended = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true, isVerified: true } })
    expect(suspended?.verificationStatus).toBe('SUSPENDED')
    expect(suspended?.isVerified).toBe(false)
  })

  it('SUSPENDED → PENDING: isVerified=false', async () => {
    await transitionCompanyVerification(prisma, {
      companyId, action: 'SUBMIT', actorId: ownerUserId, actorRole: 'COMPANY_OWNER',
    })

    const pending = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true, isVerified: true } })
    expect(pending?.verificationStatus).toBe('PENDING')
    expect(pending?.isVerified).toBe(false)
  })

  it('PENDING → VERIFIED: isVerified=true', async () => {
    await transitionCompanyVerification(prisma, {
      companyId, action: 'APPROVE', reviewedBy: 'admin', actorId: 'admin', actorRole: 'SUPER_ADMIN',
    })

    const verified = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true, isVerified: true } })
    expect(verified?.verificationStatus).toBe('VERIFIED')
    expect(verified?.isVerified).toBe(true)
  })
})
