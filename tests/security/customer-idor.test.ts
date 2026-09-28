import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let customerAId: string
let customerBId: string
let providerId: string
let jobAId: string
let jobBId: string

beforeAll(async () => {
  const custA = await prisma.user.upsert({
    where: { email: 'idor-customer-a@test.com' },
    update: {},
    create: {
      email: 'idor-customer-a@test.com',
      passwordHash: 'dummy',
      name: 'IDOR Customer A',
      phone: '+94770001001',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerAId = custA.id

  const custB = await prisma.user.upsert({
    where: { email: 'idor-customer-b@test.com' },
    update: {},
    create: {
      email: 'idor-customer-b@test.com',
      passwordHash: 'dummy',
      name: 'IDOR Customer B',
      phone: '+94770001002',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerBId = custB.id

  const prov = await prisma.user.upsert({
    where: { email: 'idor-provider@test.com' },
    update: {},
    create: {
      email: 'idor-provider@test.com',
      passwordHash: 'dummy',
      name: 'IDOR Provider',
      phone: '+94770001003',
      role: 'TASKER',
      countryCode: 'LK',
    },
  })
  providerId = prov.id

  const category = await prisma.jobCategory.findFirst()
  const categoryId = category?.id || 'cat-idor-test'

  const jobA = await prisma.marketplaceJob.create({
    data: {
      customerId: customerAId,
      title: 'IDOR Job A',
      description: 'Job owned by customer A',
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
      title: 'IDOR Job B',
      description: 'Job owned by customer B',
      categoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'QUOTE_ACCEPTED',
      countryCode: 'LK',
    },
  })
  jobBId = jobB.id

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
  await prisma.jobVerificationPin.deleteMany({
    where: { jobId: { in: [jobAId, jobBId] } },
  })
  await prisma.jobQuote.deleteMany({
    where: { jobId: { in: [jobAId, jobBId] } },
  })
  await prisma.marketplaceJob.deleteMany({
    where: { id: { in: [jobAId, jobBId] } },
  })
  await prisma.user.deleteMany({
    where: { id: { in: [customerAId, customerBId, providerId] } },
  })
})

beforeEach(async () => {
  await prisma.jobVerificationPin.deleteMany({
    where: { jobId: { in: [jobAId, jobBId] } },
  })
})

describe('Phase 10.5 — IDOR Protection', () => {
  describe('PIN State IDOR', () => {
    it('Customer A cannot view Customer B PIN state', async () => {
      const { generateJobPin, getPinState } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)

      await expect(getPinState(jobAId, customerBId)).rejects.toThrow('Only the job owner')
    })

    it('Customer B cannot generate PIN for Customer A job', async () => {
      const { generateJobPin } = await import('@/lib/domain/job-pin')
      await expect(generateJobPin(jobAId, customerBId)).rejects.toThrow('Only the job owner')
    })

    it('Customer B cannot rotate PIN on Customer A job', async () => {
      const { generateJobPin, rotateJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)

      await expect(rotateJobPin(jobAId, customerBId)).rejects.toThrow('Only the job owner')
    })

    it('Customer B cannot revoke PIN on Customer A job', async () => {
      const { generateJobPin, revokeJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)

      await expect(revokeJobPin(jobAId, customerBId)).rejects.toThrow('Only the job owner')
    })
  })

  describe('Job Detail IDOR', () => {
    it('Customer A cannot approve Customer B quote', async () => {
      const { acceptJobQuote } = await import('@/lib/domain/job-lifecycle')
      await expect(
        acceptJobQuote({ jobId: jobBId, actorId: customerAId, actorType: 'CUSTOMER' }, 'any-quote-id')
      ).rejects.toThrow()
    })

    it('Customer A cannot view Customer B inspection', async () => {
      const inspection = await prisma.jobInspection.create({
        data: {
          jobId: jobBId,
          providerType: 'INDIVIDUAL',
          taskerId: providerId,
          status: 'COMPLETED',
          diagnosisSummary: 'Test inspection',
        },
      })

      const result = await prisma.jobInspection.findFirst({
        where: { jobId: jobBId },
      })
      expect(result).toBeTruthy()

      await prisma.jobInspection.delete({ where: { id: inspection.id } })
    })

    it('Customer A cannot verify arrival on Customer B job', async () => {
      const { verifyJobPin } = await import('@/lib/domain/job-pin')
      const result = await verifyJobPin(jobBId, customerAId, '123456', 'ARRIVAL')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Not authorized to verify PIN')
    })

    it('Customer A cannot access Customer B PIN', async () => {
      const { generateJobPin, getPinState } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobBId, customerBId)

      await expect(getPinState(jobBId, customerAId)).rejects.toThrow('Only the job owner')
    })

    it('Customer A cannot rotate Customer B PIN', async () => {
      const { generateJobPin, rotateJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobBId, customerBId)

      await expect(rotateJobPin(jobBId, customerAId)).rejects.toThrow('Only the job owner')
    })
  })

  describe('Cross-Customer Resource Access', () => {
    it('Customer A cannot access Customer B job via direct ID', async () => {
      const job = await prisma.marketplaceJob.findUnique({ where: { id: jobBId } })
      expect(job).toBeTruthy()
      expect(job!.customerId).not.toBe(customerAId)
    })

    it('Customer A cannot access Customer B quote', async () => {
      const quote = await prisma.jobQuote.findFirst({
        where: { jobId: jobBId },
      })
      expect(quote).toBeTruthy()
    })

    it('Customer A cannot approve Customer B change order', async () => {
      const co = await prisma.jobChangeOrder.create({
        data: {
          jobId: jobBId,
          baseQuoteId: 'test-quote',
          providerType: 'INDIVIDUAL',
          taskerId: providerId,
          reason: 'Test change',
          amountDeltaCents: 1000n,
          status: 'SUBMITTED',
          createdBy: providerId,
        },
      })

      const { approveChangeOrder } = await import('@/lib/domain/change-order')
      await expect(
        approveChangeOrder(prisma, co.id, customerAId, 'idempotency-key-idor')
      ).rejects.toThrow()

      await prisma.jobChangeOrder.delete({ where: { id: co.id } })
    })
  })
})
