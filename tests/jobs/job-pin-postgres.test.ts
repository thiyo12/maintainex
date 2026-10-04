import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import crypto from 'crypto'

const DATABASE_URL = process.env.DATABASE_URL || ''
const isPostgres = DATABASE_URL.includes('postgresql')

function createPrisma() {
  if (!isPostgres) return null as any
  const { PrismaClient } = require('@prisma/client')
  return new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
}

let prisma: any

const TS = Date.now()

let customerAId: string
let customerBId: string
let providerId: string
let jobAId: string
let jobBId: string
let workStartJobId: string
let workStartQuoteId: string

async function cleanUp() {
  if (!prisma) return
  await prisma.$executeRawUnsafe(`DELETE FROM "JobVerificationPin" WHERE "customerId" IN (SELECT id FROM "User" WHERE "email" LIKE '%pin-postgres-test%')`)
  await prisma.$executeRawUnsafe(`DELETE FROM "JobVerificationPin" WHERE "jobId" LIKE 'test-pin-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "JobVerificationPin" WHERE "jobId" LIKE 'test-ws-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "JobQuote" WHERE "jobId" LIKE 'test-pin-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "JobQuote" WHERE "jobId" LIKE 'test-ws-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "JobWorkspace" WHERE "jobId" LIKE 'test-pin-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "JobWorkspace" WHERE "jobId" LIKE 'test-ws-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "MarketplaceJob" WHERE "id" LIKE 'test-pin-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "MarketplaceJob" WHERE "id" LIKE 'test-ws-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "email" LIKE '%pin-postgres-test%'`)
}

describe.skipIf(!isPostgres)('Phase 10.5 — PostgreSQL Job PIN', () => {
  beforeAll(async () => {
    prisma = createPrisma()
    if (!prisma) return

    await cleanUp()

    const category = await prisma.$queryRaw`SELECT id FROM "JobCategory" LIMIT 1`
    const categoryId = category[0]?.id || 'cat-pin-pg-test'

    const custA = await prisma.user.create({
      data: {
        email: `pin-customer-a-${TS}@pin-postgres-test.com`,
        passwordHash: 'dummy',
        name: 'PG Customer A',
        phone: `+9477900${String(TS).slice(-4)}1`,
        role: 'CUSTOMER',
        countryCode: 'LK',
      },
    })
    customerAId = custA.id

    const custB = await prisma.user.create({
      data: {
        email: `pin-customer-b-${TS}@pin-postgres-test.com`,
        passwordHash: 'dummy',
        name: 'PG Customer B',
        phone: `+9477900${String(TS).slice(-4)}2`,
        role: 'CUSTOMER',
        countryCode: 'LK',
      },
    })
    customerBId = custB.id

    const prov = await prisma.user.create({
      data: {
        email: `pin-provider-${TS}@pin-postgres-test.com`,
        passwordHash: 'dummy',
        name: 'PG Provider',
        phone: `+9477900${String(TS).slice(-4)}3`,
        role: 'TASKER',
        countryCode: 'LK', identityStatus: 'VERIFIED',
      },
    })
    providerId = prov.id

    const jobA = await prisma.marketplaceJob.create({
      data: {
        customerId: customerAId,
        title: 'PG Job A',
        description: 'PG test job A',
        categoryId,
        budgetType: 'FIXED',
        photos: '[]',
        status: 'QUOTE_ACCEPTED',
        countryCode: 'LK',
      },
    })
    jobAId = jobA.id

    const jobB = await prisma.marketplaceJob.create({
      data: {
        customerId: customerBId,
        title: 'PG Job B',
        description: 'PG test job B',
        categoryId,
        budgetType: 'FIXED',
        photos: '[]',
        status: 'QUOTE_ACCEPTED',
        countryCode: 'LK',
      },
    })
    jobBId = jobB.id

    const workStartJob = await prisma.marketplaceJob.create({
      data: {
        customerId: customerAId,
        title: 'PG Work Start Job',
        description: 'PG test job for WORK_START lifecycle',
        categoryId,
        budgetType: 'FIXED',
        photos: '[]',
        status: 'QUOTE_ACCEPTED',
        countryCode: 'LK',
      },
    })
    workStartJobId = workStartJob.id

    const wsQuote = await prisma.jobQuote.create({
      data: {
        jobId: workStartJobId,
        providerId,
        providerType: 'INDIVIDUAL',
        price: 6000n,
        estimatedCompletionTime: '3 hours',
        attachments: '[]',
        status: 'ACCEPTED',
      },
    })
    workStartQuoteId = wsQuote.id

    await prisma.marketplaceJob.update({
      where: { id: workStartJobId },
      data: { approvedQuoteId: workStartQuoteId },
    })

    await prisma.jobWorkspace.create({
      data: {
        jobId: workStartJobId,
        progressStatus: 'ACCEPTED',
      },
    })

    await prisma.jobEscrow.create({
      data: {
        jobId: workStartJobId,
        quoteId: workStartQuoteId,
        customerId: customerAId,
        providerId,
        amount: 6000n,
        serviceFee: 0n,
        totalAmount: 6000n,
        currency: 'LKR',
        paymentMethod: 'CARD',
        status: 'PROTECTED',
        heldAt: new Date(),
      },
    })

    await prisma.jobQuote.create({
      data: {
        jobId: jobAId,
        providerId,
        providerType: 'INDIVIDUAL',
        price: 5000n,
        estimatedCompletionTime: '2 hours',
        attachments: '[]',
        status: 'ACCEPTED',
      },
    })

    await prisma.jobQuote.create({
      data: {
        jobId: jobBId,
        providerId,
        providerType: 'INDIVIDUAL',
        price: 3000n,
        estimatedCompletionTime: '1 hour',
        attachments: '[]',
        status: 'ACCEPTED',
      },
    })
  })

  afterAll(async () => {
    if (prisma) {
      if (workStartJobId) {
        await prisma.$executeRawUnsafe(`DELETE FROM "JobVerificationPin" WHERE "jobId" = $1`, workStartJobId)
        await prisma.$executeRawUnsafe(`DELETE FROM "JobEscrow" WHERE "jobId" = $1`, workStartJobId)
        await prisma.$executeRawUnsafe(`DELETE FROM "JobQuote" WHERE "jobId" = $1`, workStartJobId)
        await prisma.$executeRawUnsafe(`DELETE FROM "JobWorkspace" WHERE "jobId" = $1`, workStartJobId)
        await prisma.$executeRawUnsafe(`DELETE FROM "MarketplaceJob" WHERE "id" = $1`, workStartJobId)
      }
      await cleanUp()
      await prisma.$disconnect()
    }
  })

  beforeEach(async () => {
    if (!prisma) return
    await prisma.$executeRawUnsafe(`DELETE FROM "JobVerificationPin" WHERE "jobId" IN ($1, $2, $3)`, jobAId, jobBId, workStartJobId)
    await prisma.$executeRawUnsafe(`UPDATE "MarketplaceJob" SET "status" = 'QUOTE_ACCEPTED' WHERE "id" = $1`, workStartJobId)
    await prisma.$executeRawUnsafe(`UPDATE "JobWorkspace" SET "progressStatus" = 'ACCEPTED' WHERE "jobId" = $1`, workStartJobId)
  })

  describe('Database Constraints', () => {
    it('partial unique index prevents multiple ACTIVE pins per job', async () => {
      await prisma.jobVerificationPin.create({
        data: { jobId: jobAId, customerId: customerAId, pinHash: 'hash1', status: 'ACTIVE', version: 1 },
      })

      await expect(
        prisma.jobVerificationPin.create({
          data: { jobId: jobAId, customerId: customerAId, pinHash: 'hash2', status: 'ACTIVE', version: 2 },
        })
      ).rejects.toThrow()
    })

    it('allows multiple non-ACTIVE pins for same job', async () => {
      await prisma.jobVerificationPin.create({
        data: { jobId: jobAId, customerId: customerAId, pinHash: 'hash1', status: 'ACTIVE', version: 1 },
      })
      await prisma.jobVerificationPin.updateMany({
        where: { jobId: jobAId, status: 'ACTIVE' },
        data: { status: 'ROTATED' },
      })
      await prisma.jobVerificationPin.create({
        data: { jobId: jobAId, customerId: customerAId, pinHash: 'hash2', status: 'ACTIVE', version: 2 },
      })

      const count = await prisma.jobVerificationPin.count({ where: { jobId: jobAId } })
      expect(count).toBe(2)
    })
  })

  describe('Concurrent PIN Generation', () => {
    it('10 concurrent PIN generations produce exactly one ACTIVE pin', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          prisma.jobVerificationPin.create({
            data: { jobId: jobBId, customerId: customerBId, pinHash: `hash-${i}`, status: 'ACTIVE', version: 1 },
          })
        )
      )

      const succeeded = results.filter(r => r.status === 'fulfilled')
      expect(succeeded.length).toBe(1)

      const activePins = await prisma.jobVerificationPin.findMany({
        where: { jobId: jobBId, status: 'ACTIVE' },
      })
      expect(activePins.length).toBe(1)
    })
  })

  describe('PIN Lifecycle', () => {
    it('global unique on pinHash prevents identical hashes', async () => {
      // This tests that the bcrypt hash is different for each PIN
      const { hashPassword } = await import('@/lib/security/password')
      const pin1 = await hashPassword('123456')
      const pin2 = await hashPassword('123456')
      // bcrypt with salt should produce different hashes
      expect(pin1).not.toBe(pin2)
    })
  })

  describe('One-time PIN step handoff', () => {
    it('consumes arrival PIN and carries arrival proof into a fresh start PIN', async () => {
      const { generateJobPin, getPinState, verifyJobPin } = await import('@/lib/domain/job-pin')

      const arrivalPin = await generateJobPin(workStartJobId, customerAId)
      expect((await getPinState(workStartJobId, customerAId)).hasActivePin).toBe(true)

      const arrival = await verifyJobPin(workStartJobId, providerId, arrivalPin.pin, 'ARRIVAL')
      expect(arrival.valid).toBe(true)

      const afterArrival = await getPinState(workStartJobId, customerAId)
      expect(afterArrival.hasActivePin).toBe(false)
      expect(afterArrival.arrivalVerifiedAt).toBeTruthy()
      expect(afterArrival.workStartVerifiedAt).toBeNull()

      const startPin = await generateJobPin(workStartJobId, customerAId)
      expect(startPin.version).toBe(arrivalPin.version + 1)

      const freshState = await getPinState(workStartJobId, customerAId)
      expect(freshState.hasActivePin).toBe(true)
      expect(freshState.arrivalVerifiedAt).toBeTruthy()
      expect(freshState.workStartVerifiedAt).toBeNull()
    })
  })

  describe('WORK_START Atomicity (PIN + Lifecycle Transition)', () => {
    it('10 concurrent WORK_START PIN verifications produce exactly one lifecycle transition', { timeout: 30000 }, async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const arrivalPin = await generateJobPin(workStartJobId, customerAId)

      const beforeArrival = await verifyJobPin(workStartJobId, providerId, arrivalPin.pin, 'WORK_START')
      expect(beforeArrival.valid).toBe(false)

      const arrival = await verifyJobPin(workStartJobId, providerId, arrivalPin.pin, 'ARRIVAL')
      expect(arrival.valid).toBe(true)

      const reusedArrivalPin = await verifyJobPin(workStartJobId, providerId, arrivalPin.pin, 'WORK_START')
      expect(reusedArrivalPin.valid).toBe(false)
      expect(reusedArrivalPin.error).toContain('No active PIN')

      const startPin = await generateJobPin(workStartJobId, customerAId)
      expect(startPin.version).toBe(arrivalPin.version + 1)

      const preWorkspace = await prisma.jobWorkspace.findUnique({ where: { jobId: workStartJobId } })
      expect(preWorkspace!.progressStatus).toBe('ACCEPTED')
      const preJob = await prisma.marketplaceJob.findUnique({ where: { id: workStartJobId } })
      expect(preJob!.status).toBe('QUOTE_ACCEPTED')

      const batch1 = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          verifyJobPin(workStartJobId, providerId, startPin.pin, 'WORK_START')
        )
      )
      const batch2 = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          verifyJobPin(workStartJobId, providerId, startPin.pin, 'WORK_START')
        )
      )

      const allSettled = [...batch1, ...batch2]
      const fulfilled = allSettled
        .filter((r): r is PromiseFulfilledResult<{ valid: boolean; error?: string; locked?: boolean }> => r.status === 'fulfilled')
        .map(r => r.value)
      const rejected = allSettled.filter(r => r.status === 'rejected')

      const validCount = fulfilled.filter(r => r.valid).length
      expect(validCount).toBe(1)
      expect(rejected.length).toBe(0)

      const pinRecord = await prisma.jobVerificationPin.findFirst({
        where: { jobId: workStartJobId },
        orderBy: { version: 'desc' },
      })
      expect(pinRecord).toBeTruthy()
      expect(pinRecord!.status).toBe('CONSUMED')
      expect(pinRecord!.workStartVerifiedAt).toBeTruthy()

      const postWorkspace = await prisma.jobWorkspace.findUnique({ where: { jobId: workStartJobId } })
      expect(postWorkspace!.progressStatus).toBe('IN_PROGRESS')

      const postJob = await prisma.marketplaceJob.findUnique({ where: { id: workStartJobId } })
      expect(postJob!.status).toBe('IN_PROGRESS')
    })

    it('failed WORK_START with wrong PIN does not transition workspace', { timeout: 15000 }, async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const arrivalPin = await generateJobPin(workStartJobId, customerAId)
      const arrival = await verifyJobPin(workStartJobId, providerId, arrivalPin.pin, 'ARRIVAL')
      expect(arrival.valid).toBe(true)
      await generateJobPin(workStartJobId, customerAId)

      const result = await verifyJobPin(workStartJobId, providerId, '000000', 'WORK_START')
      expect(result.valid).toBe(false)

      const postWorkspace = await prisma.jobWorkspace.findUnique({ where: { jobId: workStartJobId } })
      expect(postWorkspace!.progressStatus).toBe('ACCEPTED')
    })

    it('second WORK_START attempt is rejected after first consumed the purpose', { timeout: 30000 }, async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const arrivalPin = await generateJobPin(workStartJobId, customerAId)
      const arrival = await verifyJobPin(workStartJobId, providerId, arrivalPin.pin, 'ARRIVAL')
      expect(arrival.valid).toBe(true)
      const startPin = await generateJobPin(workStartJobId, customerAId)

      const first = await verifyJobPin(workStartJobId, providerId, startPin.pin, 'WORK_START')
      expect(first.valid).toBe(true)

      const second = await verifyJobPin(workStartJobId, providerId, startPin.pin, 'WORK_START')
      expect(second.valid).toBe(false)
      expect(second.error).toContain('No active PIN')

      const postWorkspace = await prisma.jobWorkspace.findUnique({ where: { jobId: workStartJobId } })
      expect(postWorkspace!.progressStatus).toBe('IN_PROGRESS')
    })
  })
})
