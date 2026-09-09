import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'
import { transitionCompanyVerification } from '@/lib/phase6/kyc-writer'

const prisma = new PrismaClient()

describe('Phase 6.4 — User KYC / Company Verification Separation', () => {
  let ownerUserId: string
  let companyId: string
  let ownerIdCardDocId: string

  beforeAll(async () => {
    const ts = Date.now()

    const owner = await prisma.user.create({
      data: { email: `kyc-sep-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY', identityStatus: 'NOT_SUBMITTED' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: { userId: ownerUserId, companyName: `Sep Co ${ts}`, services: '[]', serviceAreas: '[]', isVerified: false, verificationStatus: 'UNVERIFIED' },
    })
    companyId = company.id

    await prisma.teamMember.create({
      data: { companyId, userId: ownerUserId, name: 'Owner', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const doc = await prisma.identityDocument.create({
      data: { userId: ownerUserId, docType: 'NATIONAL_ID', side: 'FRONT', imageUrl: 'http://test.com/id.jpg', status: 'PENDING' },
    })
    ownerIdCardDocId = doc.id
  })

  afterAll(async () => {
    await prisma.identityDocument.deleteMany({ where: { userId: ownerUserId } })
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => {})
  })

  it('owner personal KYC APPROVED: User.identityStatus = VERIFIED, CompanyProfile unchanged', async () => {
    await transitionUserKyc(prisma, {
      userId: ownerUserId,
      action: 'SUBMIT',
      documentId: ownerIdCardDocId,
    })

    const userAfterSubmit = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { identityStatus: true } })
    expect(userAfterSubmit?.identityStatus).toBe('PENDING')

    const companyAfterSubmit = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(companyAfterSubmit?.verificationStatus).toBe('UNVERIFIED')

    await transitionUserKyc(prisma, {
      userId: ownerUserId,
      action: 'APPROVE',
      documentId: ownerIdCardDocId,
      reviewedBy: 'admin',
    })

    const userAfterApprove = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { identityStatus: true } })
    expect(userAfterApprove?.identityStatus).toBe('VERIFIED')

    const companyAfterApprove = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(companyAfterApprove?.verificationStatus).toBe('UNVERIFIED')
  })

  it('company verification submission: UNVERIFIED -> PENDING', async () => {
    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUBMIT',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(company?.verificationStatus).toBe('PENDING')

    const user = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { identityStatus: true } })
    expect(user?.identityStatus).toBe('VERIFIED')
  })

  it('authorized company verification approval: PENDING -> VERIFIED', async () => {
    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'APPROVE',
      reviewNote: 'Company documents verified',
      reviewedBy: 'admin',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true, isVerified: true } })
    expect(company?.verificationStatus).toBe('VERIFIED')
    expect(company?.isVerified).toBe(true)
  })

  it('illegal company transition: zero writes', async () => {
    const companyBefore = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })

    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUBMIT',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid company verification transition')

    const companyAfter = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(companyAfter?.verificationStatus).toBe(companyBefore?.verificationStatus)
  })

  it('personal KYC rejection: must not automatically reject the company', async () => {
    const companyBefore = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })

    const result = await transitionUserKyc(prisma, {
      userId: ownerUserId,
      action: 'SUSPEND',
    })
    expect(result.success).toBe(true)

    const user = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { identityStatus: true } })
    expect(user?.identityStatus).toBe('SUSPENDED')

    const companyAfter = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(companyAfter?.verificationStatus).toBe(companyBefore?.verificationStatus)
  })

  it('company verification rejection: only affects company, not user identity', async () => {
    await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUSPEND',
      reviewedBy: 'admin',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUBMIT',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })

    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'REJECT',
      reviewNote: 'Insufficient documentation',
      reviewedBy: 'admin',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(company?.verificationStatus).toBe('REJECTED')

    const user = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { identityStatus: true } })
    expect(user?.identityStatus).not.toBe('REJECTED')
  })

  it('company suspend: only affects company, not user identity', async () => {
    await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUBMIT',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    await transitionCompanyVerification(prisma, {
      companyId,
      action: 'APPROVE',
      reviewedBy: 'admin',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })

    const result = await transitionCompanyVerification(prisma, {
      companyId,
      action: 'SUSPEND',
      reviewNote: 'Policy violation',
      reviewedBy: 'admin',
      actorId: ownerUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(result.success).toBe(true)

    const company = await prisma.companyProfile.findUnique({ where: { id: companyId }, select: { verificationStatus: true } })
    expect(company?.verificationStatus).toBe('SUSPENDED')

    const user = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { identityStatus: true } })
    expect(user?.identityStatus).toBe('SUSPENDED')
  })
})
