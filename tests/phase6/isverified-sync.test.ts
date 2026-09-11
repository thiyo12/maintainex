import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'
import { requiresPostgres } from '../test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.5 — TaskerProfile isVerified Sync', () => {
  let userId: string
  let taskerProfileId: string
  let docId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: { email: `isv-sync-${ts}@test.com`, passwordHash: 'hash', name: 'SyncUser', role: 'TASKER', identityStatus: 'NOT_SUBMITTED' },
    })
    userId = user.id

    const profile = await prisma.taskerProfile.create({
      data: { userId, hourlyRate: 500, bio: 'test', skills: '[]', serviceAreas: '[]', verificationStatus: 'NOT_SUBMITTED', isVerified: false },
    })
    taskerProfileId = profile.id

    const doc = await prisma.identityDocument.create({
      data: { userId, docType: 'PASSPORT', side: 'FRONT', imageUrl: 'http://test.com/id.jpg', status: 'PENDING' },
    })
    docId = doc.id
  })

  afterAll(async () => {
    await prisma.identityDocument.deleteMany({ where: { userId } })
    await prisma.taskerProfile.delete({ where: { id: taskerProfileId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  })

  it('APPROVE sets isVerified=true', async () => {
    await transitionUserKyc(prisma, { userId, action: 'SUBMIT', documentId: docId })
    await transitionUserKyc(prisma, { userId, action: 'APPROVE', documentId: docId, reviewedBy: 'admin' })

    const profile = await prisma.taskerProfile.findUnique({ where: { id: taskerProfileId }, select: { isVerified: true, verificationStatus: true } })
    expect(profile?.isVerified).toBe(true)
    expect(profile?.verificationStatus).toBe('VERIFIED')
  })

  it('SUSPEND sets isVerified=false', async () => {
    await transitionUserKyc(prisma, { userId, action: 'SUSPEND' })

    const profile = await prisma.taskerProfile.findUnique({ where: { id: taskerProfileId }, select: { isVerified: true, verificationStatus: true } })
    expect(profile?.isVerified).toBe(false)
    expect(profile?.verificationStatus).toBe('SUSPENDED')
  })

  it('RE-APPROVE sets isVerified=true again', async () => {
    await transitionUserKyc(prisma, { userId, action: 'SUBMIT', documentId: docId })
    await transitionUserKyc(prisma, { userId, action: 'APPROVE', documentId: docId, reviewedBy: 'admin' })

    const profile = await prisma.taskerProfile.findUnique({ where: { id: taskerProfileId }, select: { isVerified: true, verificationStatus: true } })
    expect(profile?.isVerified).toBe(true)
    expect(profile?.verificationStatus).toBe('VERIFIED')
  })

  it('SUBMIT (to PENDING) sets isVerified=false from VERIFIED state', async () => {
    await transitionUserKyc(prisma, { userId, action: 'SUSPEND' })
    await transitionUserKyc(prisma, { userId, action: 'SUBMIT', documentId: docId })

    const profile = await prisma.taskerProfile.findUnique({ where: { id: taskerProfileId }, select: { isVerified: true, verificationStatus: true } })
    expect(profile?.isVerified).toBe(false)
    expect(profile?.verificationStatus).toBe('PENDING')
  })
})
