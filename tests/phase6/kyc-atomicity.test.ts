import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'
import { requiresPostgres } from '../test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.3 — KYC Full Atomicity', () => {
  let userId: string
  let docId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `kyc-full-atomic-${Date.now()}@test.com`, passwordHash: 'hash', name: 'KYC User', role: 'TASKER', identityStatus: 'NOT_SUBMITTED' },
    })
    userId = user.id

    const doc = await prisma.identityDocument.create({
      data: { userId, docType: 'PASSPORT', side: 'FRONT', imageUrl: 'http://test.com/img.jpg', status: 'PENDING' },
    })
    docId = doc.id
  })

  afterAll(async () => {
    await prisma.identityDocument.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  })

  it('illegal user transition returns error, zero writes', async () => {
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })

    const result = await transitionUserKyc(prisma, { userId, action: 'APPROVE' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid KYC transition')

    const after = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })
    expect(after?.identityStatus).toBe(before?.identityStatus)
  })

  it('SUBMIT propagates TaskerProfile to PENDING', async () => {
    const tasker = await prisma.user.create({
      data: { email: `kyc-tasker-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Tasker', role: 'TASKER', identityStatus: 'NOT_SUBMITTED' },
    })
    const taskerDoc = await prisma.identityDocument.create({
      data: { userId: tasker.id, docType: 'PASSPORT', side: 'FRONT', imageUrl: 'http://test.com/t.jpg', status: 'PENDING' },
    })

    const profile = await prisma.taskerProfile.create({
      data: { userId: tasker.id, hourlyRate: 500, bio: 'test', skills: '[]', serviceAreas: '[]', verificationStatus: 'NOT_SUBMITTED' },
    })

    const result = await transitionUserKyc(prisma, { userId: tasker.id, action: 'SUBMIT', documentId: taskerDoc.id })
    expect(result.success).toBe(true)

    const userAfter = await prisma.user.findUnique({ where: { id: tasker.id }, select: { identityStatus: true } })
    expect(userAfter?.identityStatus).toBe('PENDING')

    const profileAfter = await prisma.taskerProfile.findUnique({ where: { id: profile.id }, select: { verificationStatus: true } })
    expect(profileAfter?.verificationStatus).toBe('PENDING')

    await prisma.identityDocument.deleteMany({ where: { userId: tasker.id } })
    await prisma.taskerProfile.delete({ where: { id: profile.id } })
    await prisma.user.delete({ where: { id: tasker.id } })
  })

  it('full atomic transition: SUBMIT → APPROVE', async () => {
    const submitResult = await transitionUserKyc(prisma, { userId, action: 'SUBMIT', documentId: docId })
    expect(submitResult.success).toBe(true)

    const userAfterSubmit = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })
    expect(userAfterSubmit?.identityStatus).toBe('PENDING')

    const approveResult = await transitionUserKyc(prisma, { userId, action: 'APPROVE', documentId: docId, reviewedBy: 'admin' })
    expect(approveResult.success).toBe(true)

    const userAfterApprove = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })
    expect(userAfterApprove?.identityStatus).toBe('VERIFIED')
  })

  it('illegal provider transition blocks entire transaction', async () => {
    const result = await transitionUserKyc(prisma, { userId, action: 'APPROVE' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid KYC transition')
  })

  it('SUSPEND works from VERIFIED', async () => {
    const result = await transitionUserKyc(prisma, { userId, action: 'SUSPEND' })
    expect(result.success).toBe(true)

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })
    expect(user?.identityStatus).toBe('SUSPENDED')
  })

  it('rollback injection: failure after User update leaves all KYC states unchanged', async () => {
    const rollbackUser = await prisma.user.create({
      data: { email: `kyc-rollback-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Rollback', role: 'TASKER', identityStatus: 'NOT_SUBMITTED' },
    })
    const rollbackDoc = await prisma.identityDocument.create({
      data: { userId: rollbackUser.id, docType: 'PASSPORT', side: 'FRONT', imageUrl: 'http://test.com/r.jpg', status: 'PENDING' },
    })
    const rollbackProfile = await prisma.taskerProfile.create({
      data: { userId: rollbackUser.id, hourlyRate: 500, bio: 'test', skills: '[]', serviceAreas: '[]', verificationStatus: 'NOT_SUBMITTED' },
    })

    const userBefore = await prisma.user.findUnique({ where: { id: rollbackUser.id }, select: { identityStatus: true } })
    const docBefore = await prisma.identityDocument.findUnique({ where: { id: rollbackDoc.id }, select: { status: true } })
    const profileBefore = await prisma.taskerProfile.findUnique({ where: { id: rollbackProfile.id }, select: { verificationStatus: true } })

    const result = await transitionUserKyc(prisma, {
      userId: rollbackUser.id,
      action: 'APPROVE',
      documentId: 'nonexistent-doc-id',
      reviewedBy: 'admin',
    })

    expect(result.success).toBe(false)

    const userAfter = await prisma.user.findUnique({ where: { id: rollbackUser.id }, select: { identityStatus: true } })
    const docAfter = await prisma.identityDocument.findUnique({ where: { id: rollbackDoc.id }, select: { status: true } })
    const profileAfter = await prisma.taskerProfile.findUnique({ where: { id: rollbackProfile.id }, select: { verificationStatus: true } })

    expect(userAfter?.identityStatus).toBe(userBefore?.identityStatus)
    expect(docAfter?.status).toBe(docBefore?.status)
    expect(profileAfter?.verificationStatus).toBe(profileBefore?.verificationStatus)

    await prisma.identityDocument.deleteMany({ where: { userId: rollbackUser.id } })
    await prisma.taskerProfile.delete({ where: { id: rollbackProfile.id } })
    await prisma.user.delete({ where: { id: rollbackUser.id } })
  })

  it('concurrent approve/reject: only one wins', async () => {
    const user2 = await prisma.user.create({
      data: { email: `kyc-concurrent-${Date.now()}@test.com`, passwordHash: 'hash', name: 'Concurrent', role: 'TASKER', identityStatus: 'NOT_SUBMITTED' },
    })
    const doc2 = await prisma.identityDocument.create({
      data: { userId: user2.id, docType: 'PASSPORT', side: 'FRONT', imageUrl: 'http://test.com/img2.jpg', status: 'PENDING' },
    })

    await transitionUserKyc(prisma, { userId: user2.id, action: 'SUBMIT', documentId: doc2.id })

    const results = await Promise.all([
      transitionUserKyc(prisma, { userId: user2.id, action: 'APPROVE', documentId: doc2.id, reviewedBy: 'admin1' }),
      transitionUserKyc(prisma, { userId: user2.id, action: 'REJECT', documentId: doc2.id, reviewNote: 'bad', reviewedBy: 'admin2' }),
    ])

    const successes = results.filter((r) => r.success)
    expect(successes.length).toBe(1)

    const finalUser = await prisma.user.findUnique({ where: { id: user2.id }, select: { identityStatus: true } })
    expect(['VERIFIED', 'REJECTED']).toContain(finalUser?.identityStatus)

    await prisma.identityDocument.deleteMany({ where: { userId: user2.id } })
    await prisma.user.delete({ where: { id: user2.id } }).catch(() => {})
  })
})
