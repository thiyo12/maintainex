import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'

const prisma = new PrismaClient()

describe('Phase 6.2 — KYC Writer Atomicity', () => {
  let userId: string
  let docId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `kyc-atomic-${Date.now()}@test.com`, passwordHash: 'hash', name: 'KYC User', role: 'TASKER', identityStatus: 'NOT_SUBMITTED' },
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
