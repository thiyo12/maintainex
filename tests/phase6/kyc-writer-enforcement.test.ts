import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'
import { isValidKycTransition } from '@/lib/phase6/kyc'

const prisma = new PrismaClient()

describe('Phase 6.1 — KYC State Machine Enforcement', () => {
  let userId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `kyc-writer-${Date.now()}@test.com`, passwordHash: 'hash', name: 'KYC User', role: 'TASKER', identityStatus: 'NOT_SUBMITTED' },
    })
    userId = user.id
  })

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  })

  it('validates transitions in helper', () => {
    expect(isValidKycTransition('NOT_SUBMITTED', 'PENDING')).toBe(true)
    expect(isValidKycTransition('NOT_SUBMITTED', 'VERIFIED')).toBe(false)
    expect(isValidKycTransition('PENDING', 'VERIFIED')).toBe(true)
    expect(isValidKycTransition('PENDING', 'REJECTED')).toBe(true)
    expect(isValidKycTransition('VERIFIED', 'SUSPENDED')).toBe(true)
    expect(isValidKycTransition('REJECTED', 'PENDING')).toBe(true)
  })

  it('SUBMIT transitions NOT_SUBMITTED → PENDING', async () => {
    const doc = await prisma.identityDocument.create({
      data: { userId, docType: 'PASSPORT', side: 'FRONT', imageUrl: 'http://test.com/img.jpg', status: 'PENDING' },
    })
    const result = await transitionUserKyc(prisma, { userId, action: 'SUBMIT', documentId: doc.id })
    expect(result.success).toBe(true)

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })
    expect(user?.identityStatus).toBe('PENDING')
  })

  it('APPROVE transitions PENDING → VERIFIED', async () => {
    const docs = await prisma.identityDocument.findMany({ where: { userId } })
    const result = await transitionUserKyc(prisma, { userId, action: 'APPROVE', documentId: docs[0]?.id, reviewedBy: 'admin' })
    expect(result.success).toBe(true)

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })
    expect(user?.identityStatus).toBe('VERIFIED')
  })

  it('rejects illegal transition NOT_SUBMITTED → VERIFIED', async () => {
    const user2 = await prisma.user.create({
      data: { email: `kyc-writer-2-${Date.now()}@test.com`, passwordHash: 'hash', name: 'KYC User 2', role: 'TASKER', identityStatus: 'NOT_SUBMITTED' },
    })
    const result = await transitionUserKyc(prisma, { userId: user2.id, action: 'APPROVE' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid KYC transition')
    await prisma.user.delete({ where: { id: user2.id } }).catch(() => {})
  })

  it('SUSPEND transitions VERIFIED → SUSPENDED', async () => {
    const result = await transitionUserKyc(prisma, { userId, action: 'SUSPEND' })
    expect(result.success).toBe(true)

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })
    expect(user?.identityStatus).toBe('SUSPENDED')
  })

  it('no partial writes on illegal transition', async () => {
    const originalUser = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })

    const result = await transitionUserKyc(prisma, { userId, action: 'APPROVE' })
    expect(result.success).toBe(false)

    const afterUser = await prisma.user.findUnique({ where: { id: userId }, select: { identityStatus: true } })
    expect(afterUser?.identityStatus).toBe(originalUser?.identityStatus)
  })
})
