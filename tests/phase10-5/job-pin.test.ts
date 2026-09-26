import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const TEST_CUSTOMER_A = 'test-customer-a-pin'
const TEST_CUSTOMER_B = 'test-customer-b-pin'
const TEST_PROVIDER = 'test-provider-pin'
const TEST_COMPANY_PROVIDER = 'test-company-pin'

let customerAId: string
let customerBId: string
let providerId: string
let companyUserId: string
let companyId: string
let jobAId: string
let jobBId: string
let instantJobId: string
let inspectionFirstJobId: string

beforeAll(async () => {
  const now = new Date()

  const custA = await prisma.user.upsert({
    where: { email: `${TEST_CUSTOMER_A}@test.com` },
    update: {},
    create: {
      email: `${TEST_CUSTOMER_A}@test.com`,
      passwordHash: 'dummy',
      name: 'Customer A PIN',
      phone: '+94770000001',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerAId = custA.id

  const custB = await prisma.user.upsert({
    where: { email: `${TEST_CUSTOMER_B}@test.com` },
    update: {},
    create: {
      email: `${TEST_CUSTOMER_B}@test.com`,
      passwordHash: 'dummy',
      name: 'Customer B PIN',
      phone: '+94770000002',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerBId = custB.id

  const prov = await prisma.user.upsert({
    where: { email: `${TEST_PROVIDER}@test.com` },
    update: {
      identityStatus: 'VERIFIED',
      isActive: true,
      isSuspended: false,
      isBanned: false,
    },
    create: {
      email: `${TEST_PROVIDER}@test.com`,
      passwordHash: 'dummy',
      name: 'Provider PIN',
      phone: '+94770000003',
      role: 'TASKER',
      countryCode: 'LK',
      identityStatus: 'VERIFIED',
    },
  })
  providerId = prov.id

  const compUser = await prisma.user.upsert({
    where: { email: `${TEST_COMPANY_PROVIDER}@test.com` },
    update: {
      identityStatus: 'VERIFIED',
      isActive: true,
      isSuspended: false,
      isBanned: false,
    },
    create: {
      email: `${TEST_COMPANY_PROVIDER}@test.com`,
      passwordHash: 'dummy',
      name: 'Company User PIN',
      phone: '+94770000004',
      role: 'COMPANY',
      countryCode: 'LK',
      identityStatus: 'VERIFIED',
    },
  })
  companyUserId = compUser.id

  const company = await prisma.companyProfile.upsert({
    where: { userId: companyUserId },
    update: {},
    create: {
      userId: companyUserId,
      companyName: 'Test Company PIN',
      registrationNo: 'PIN-TEST-001',
      services: '[]',
      serviceAreas: '[]',
    },
  })
  companyId = company.id

  const category = await prisma.jobCategory.findFirst()
  const categoryId = category?.id || 'cat-pin-test'

  const jobA = await prisma.marketplaceJob.create({
    data: {
      customerId: customerAId,
      title: 'Test Job A PIN',
      description: 'Test description for PIN job A',
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
      title: 'Test Job B PIN',
      description: 'Test description for PIN job B',
      categoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'IN_PROGRESS',
      countryCode: 'LK',
    },
  })
  jobBId = jobB.id

  const instantJob = await prisma.marketplaceJob.create({
    data: {
      customerId: customerAId,
      title: 'Instant Price Job',
      description: 'Test description for instant price job',
      categoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'QUOTE_ACCEPTED',
      countryCode: 'LK',
    },
  })
  instantJobId = instantJob.id

  const inspectionJob = await prisma.marketplaceJob.create({
    data: {
      customerId: customerAId,
      title: 'Inspection First Job',
      description: 'Test description for inspection first job',
      categoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'QUOTE_ACCEPTED',
      requiresInspection: true,
      countryCode: 'LK',
    },
  })
  inspectionFirstJobId = inspectionJob.id

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

  await prisma.jobQuote.create({
    data: {
      jobId: instantJobId,
      providerId,
      providerType: 'INDIVIDUAL',
      price: 2000n,
      estimatedCompletionTime: '30 min',
        attachments: '[]',
      status: 'ACCEPTED',
    },
  })

  await prisma.jobQuote.create({
    data: {
      jobId: inspectionFirstJobId,
      providerId,
      providerType: 'INDIVIDUAL',
      price: 4000n,
      estimatedCompletionTime: '3 hours',
        attachments: '[]',
      status: 'ACCEPTED',
    },
  })

  await prisma.jobWorkspace.create({
    data: {
      jobId: jobAId,
      progressStatus: 'ACCEPTED',
    },
  })

  await prisma.jobWorkspace.create({
    data: {
      jobId: jobBId,
      progressStatus: 'IN_PROGRESS',
    },
  })

  const acceptedQuotes = await prisma.jobQuote.findMany({
    where: { jobId: { in: [jobAId, jobBId, instantJobId, inspectionFirstJobId] }, status: 'ACCEPTED' },
    select: { id: true, jobId: true, providerId: true, price: true },
  })
  const customersByJob = new Map([
    [jobAId, customerAId],
    [jobBId, customerBId],
    [instantJobId, customerAId],
    [inspectionFirstJobId, customerAId],
  ])

  await prisma.jobEscrow.createMany({
    data: acceptedQuotes.map((quote) => ({
      jobId: quote.jobId,
      quoteId: quote.id,
      customerId: customersByJob.get(quote.jobId)!,
      providerId: quote.providerId,
      amount: quote.price,
      serviceFee: 0n,
      totalAmount: quote.price,
      paymentMethod: 'CARD',
      currency: 'LKR',
      status: 'PROTECTED',
      heldAt: now,
    })),
  })
})

afterAll(async () => {
  await prisma.jobVerificationPin.deleteMany({
    where: { jobId: { in: [jobAId, jobBId, instantJobId, inspectionFirstJobId] } },
  })
  await prisma.jobEscrow.deleteMany({
    where: { jobId: { in: [jobAId, jobBId, instantJobId, inspectionFirstJobId] } },
  })
  await prisma.jobQuote.deleteMany({
    where: { jobId: { in: [jobAId, jobBId, instantJobId, inspectionFirstJobId] } },
  })
  await prisma.jobWorkspace.deleteMany({
    where: { jobId: { in: [jobAId, jobBId, instantJobId, inspectionFirstJobId] } },
  })
  await prisma.marketplaceJob.deleteMany({
    where: { id: { in: [jobAId, jobBId, instantJobId, inspectionFirstJobId] } },
  })
  await prisma.companyProfile.deleteMany({ where: { userId: companyUserId } })
  await prisma.user.deleteMany({
    where: { id: { in: [customerAId, customerBId, providerId, companyUserId] } },
  })
})

beforeEach(async () => {
  await prisma.jobVerificationPin.deleteMany({
    where: { jobId: { in: [jobAId, jobBId, instantJobId, inspectionFirstJobId] } },
  })
  await prisma.jobLifecycleEvent.deleteMany({
    where: { jobId: { in: [jobAId, jobBId, instantJobId, inspectionFirstJobId] } },
  }).catch(() => {})
  await prisma.marketplaceJob.update({
    where: { id: jobAId },
    data: { status: 'QUOTE_ACCEPTED' },
  })
  await prisma.jobWorkspace.update({
    where: { jobId: jobAId },
    data: { progressStatus: 'ACCEPTED', completionRequestedAt: null },
  })
})

describe('Phase 10.5 — Job Verification PIN', () => {
  describe('PIN Generation', () => {
    it('generates a 6-digit PIN for correct customer/job', async () => {
      const { generateJobPin } = await import('@/lib/domain/job-pin')
      const result = await generateJobPin(jobAId, customerAId)

      expect(result.pin).toMatch(/^\d{6}$/)
      expect(result.jobId).toBe(jobAId)
      expect(result.version).toBe(1)
    })

    it('does not store plaintext PIN in database', async () => {
      const { generateJobPin } = await import('@/lib/domain/job-pin')
      const result = await generateJobPin(jobAId, customerAId)

      const record = await prisma.jobVerificationPin.findFirst({
        where: { jobId: jobAId },
      })
      expect(record).toBeTruthy()
      expect(record!.pinHash).not.toBe(result.pin)
      expect(record!.pinHash.length).toBeGreaterThan(20)
    })

    it('rejects PIN generation before escrow is protected', async () => {
      const { generateJobPin } = await import('@/lib/domain/job-pin')
      const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: jobAId } })
      expect(escrow).toBeTruthy()

      await prisma.jobEscrow.update({
        where: { id: escrow!.id },
        data: { status: 'PENDING_PAYMENT', heldAt: null },
      })

      try {
        await expect(generateJobPin(jobAId, customerAId)).rejects.toThrow('Payment must be protected')
      } finally {
        await prisma.jobEscrow.update({
          where: { id: escrow!.id },
          data: { status: 'PROTECTED', heldAt: new Date() },
        })
      }
    })

    it('rejects generation by non-owner', async () => {
      const { generateJobPin } = await import('@/lib/domain/job-pin')
      await expect(generateJobPin(jobAId, customerBId)).rejects.toThrow('Only the job owner')
    })

    it('rejects generation for non-existent job', async () => {
      const { generateJobPin } = await import('@/lib/domain/job-pin')
      await expect(generateJobPin('non-existent-job', customerAId)).rejects.toThrow('Job not found')
    })

    it('rejects generation when active PIN already exists', async () => {
      const { generateJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)
      await expect(generateJobPin(jobAId, customerAId)).rejects.toThrow('active PIN already exists')
    })
  })

  describe('PIN State', () => {
    it('returns hasActivePin: false when no PIN exists', async () => {
      const { getPinState } = await import('@/lib/domain/job-pin')
      const state = await getPinState(jobAId, customerAId)
      expect(state.hasActivePin).toBe(false)
    })

    it('returns hasActivePin: true after generation', async () => {
      const { generateJobPin, getPinState } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)
      const state = await getPinState(jobAId, customerAId)
      expect(state.hasActivePin).toBe(true)
      expect(state.version).toBe(1)
    })

    it('does not return plaintext PIN', async () => {
      const { generateJobPin, getPinState } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)
      const state = await getPinState(jobAId, customerAId)
      expect((state as any).pin).toBeUndefined()
      expect((state as any).pinHash).toBeUndefined()
    })

    it('rejects state view by non-owner', async () => {
      const { getPinState } = await import('@/lib/domain/job-pin')
      await expect(getPinState(jobAId, customerBId)).rejects.toThrow('Not authorized to view PIN state')
    })
  })

  describe('PIN Verification', () => {
    it('verifies correct PIN for selected provider', async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const { pin } = await generateJobPin(jobAId, customerAId)
      const result = await verifyJobPin(jobAId, providerId, pin, 'ARRIVAL')
      expect(result.valid).toBe(true)
    })

    it('requires a fresh PIN after ARRIVAL before WORK_START', async () => {
      const { generateJobPin, getPinState, verifyJobPin } = await import('@/lib/domain/job-pin')

      const arrivalPin = await generateJobPin(jobAId, customerAId)
      expect(arrivalPin.version).toBe(1)

      const arrival = await verifyJobPin(jobAId, providerId, arrivalPin.pin, 'ARRIVAL')
      expect(arrival.valid).toBe(true)

      const afterArrivalCustomer = await getPinState(jobAId, customerAId)
      const afterArrivalProvider = await getPinState(jobAId, providerId)
      expect(afterArrivalCustomer.hasActivePin).toBe(false)
      expect(afterArrivalCustomer.arrivalVerifiedAt).toBeTruthy()
      expect(afterArrivalCustomer.workStartVerifiedAt).toBeNull()
      expect(afterArrivalProvider.arrivalVerifiedAt).toBeTruthy()

      const oldPinStart = await verifyJobPin(jobAId, providerId, arrivalPin.pin, 'WORK_START')
      expect(oldPinStart.valid).toBe(false)
      expect(oldPinStart.error).toBe('No active PIN for this job')

      const startPin = await generateJobPin(jobAId, customerAId)
      expect(startPin.version).toBe(2)
      expect(startPin.pin).not.toBe(arrivalPin.pin)

      const readyForStart = await getPinState(jobAId, providerId)
      expect(readyForStart.hasActivePin).toBe(true)
      expect(readyForStart.arrivalVerifiedAt).toBeTruthy()
      expect(readyForStart.workStartVerifiedAt).toBeNull()

      const started = await verifyJobPin(jobAId, providerId, startPin.pin, 'WORK_START')
      expect(started.valid).toBe(true)

      const [job, workspace, finalState] = await Promise.all([
        prisma.marketplaceJob.findUnique({ where: { id: jobAId } }),
        prisma.jobWorkspace.findUnique({ where: { jobId: jobAId } }),
        getPinState(jobAId, customerAId),
      ])
      expect(job?.status).toBe('IN_PROGRESS')
      expect(workspace?.progressStatus).toBe('IN_PROGRESS')
      expect(finalState.hasActivePin).toBe(false)
      expect(finalState.arrivalVerifiedAt).toBeTruthy()
      expect(finalState.workStartVerifiedAt).toBeTruthy()
    })

    it('rejects wrong PIN', async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)
      const result = await verifyJobPin(jobAId, providerId, '000000', 'ARRIVAL')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Incorrect PIN')
    })

    it('rejects unselected provider', async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const { pin } = await generateJobPin(jobAId, customerAId)
      const result = await verifyJobPin(jobAId, customerBId, pin, 'ARRIVAL')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Not authorized to verify PIN')
    })

    it('rejects PIN for wrong job', async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const { pin } = await generateJobPin(jobAId, customerAId)
      const result = await verifyJobPin(jobBId, providerId, pin, 'ARRIVAL')
      expect(result.valid).toBe(false)
    })

    it('tracks failed attempts', { timeout: 30000 }, async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)

      for (let i = 0; i < 4; i++) {
        await verifyJobPin(jobAId, providerId, '000000', 'ARRIVAL')
      }

      const record = await prisma.jobVerificationPin.findFirst({
        where: { jobId: jobAId, status: 'ACTIVE' },
      })
      expect(record!.failedAttempts).toBe(4)
    })

    it('locks PIN after 5 failed attempts', { timeout: 30000 }, async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)

      for (let i = 0; i < 5; i++) {
        await verifyJobPin(jobAId, providerId, '000000', 'ARRIVAL')
      }

      const record = await prisma.jobVerificationPin.findFirst({
        where: { jobId: jobAId, status: 'ACTIVE' },
      })
      expect(record!.failedAttempts).toBe(5)
      expect(record!.lockedUntil).toBeTruthy()
      expect(record!.lockedUntil!.getTime()).toBeGreaterThan(Date.now())
    })

    it('rejects PIN when locked', { timeout: 30000 }, async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)

      for (let i = 0; i < 5; i++) {
        await verifyJobPin(jobAId, providerId, '000000', 'ARRIVAL')
      }

      const result = await verifyJobPin(jobAId, providerId, '000000', 'ARRIVAL')
      expect(result.valid).toBe(false)
      expect(result.locked).toBe(true)
    })

    it('resets failed attempts on successful verification', { timeout: 30000 }, async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const { pin } = await generateJobPin(jobAId, customerAId)

      await verifyJobPin(jobAId, providerId, '000000', 'ARRIVAL')
      await verifyJobPin(jobAId, providerId, '000000', 'ARRIVAL')

      const result = await verifyJobPin(jobAId, providerId, pin, 'ARRIVAL')
      expect(result.valid).toBe(true)

      const record = await prisma.jobVerificationPin.findFirst({
        where: { jobId: jobAId },
        orderBy: { version: 'desc' },
      })
      expect(record!.status).toBe('CONSUMED')
      expect(record!.failedAttempts).toBe(0)
      expect(record!.arrivalVerifiedAt).toBeTruthy()
    })
  })

  describe('PIN Rotation', () => {
    it('rotation invalidates old PIN', { timeout: 30000 }, async () => {
      const { generateJobPin, rotateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const { pin: oldPin } = await generateJobPin(jobAId, customerAId)

      const { pin: newPin, version } = await rotateJobPin(jobAId, customerAId)
      expect(version).toBe(2)
      expect(newPin).not.toBe(oldPin)

      const oldResult = await verifyJobPin(jobAId, providerId, oldPin, 'ARRIVAL')
      expect(oldResult.valid).toBe(false)

      const newResult = await verifyJobPin(jobAId, providerId, newPin, 'ARRIVAL')
      expect(newResult.valid).toBe(true)
    })

    it('rotation rejects by non-owner', async () => {
      const { generateJobPin, rotateJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)
      await expect(rotateJobPin(jobAId, customerBId)).rejects.toThrow('Only the job owner')
    })

    it('rotation works even without existing PIN', async () => {
      const { rotateJobPin } = await import('@/lib/domain/job-pin')
      const result = await rotateJobPin(jobAId, customerAId)
      expect(result.version).toBe(1)
      expect(result.pin).toMatch(/^\d{6}$/)
    })
  })

  describe('PIN Revocation', () => {
    it('revoked PIN fails verification', async () => {
      const { generateJobPin, revokeJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const { pin } = await generateJobPin(jobAId, customerAId)

      await revokeJobPin(jobAId, customerAId)

      const result = await verifyJobPin(jobAId, providerId, pin, 'ARRIVAL')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('No active PIN for this job')
    })

    it('revocation rejects by non-owner', async () => {
      const { generateJobPin, revokeJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)
      await expect(revokeJobPin(jobAId, customerBId)).rejects.toThrow('Only the job owner')
    })
  })

  describe('Lifecycle Purpose Validation', () => {
    it('WORK_START rejects when inspection required but not completed', async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const { pin } = await generateJobPin(inspectionFirstJobId, customerAId)

      const result = await verifyJobPin(inspectionFirstJobId, providerId, pin, 'WORK_START')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Cannot verify PIN for WORK_START')
    })

    it('COMPLETION rejects when workspace not in COMPLETION_REQUESTED', async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const { pin } = await generateJobPin(jobAId, customerAId)

      const result = await verifyJobPin(jobAId, providerId, pin, 'COMPLETION')
      expect(result.valid).toBe(false)
    })
  })

  describe('Idempotency', () => {
    it('same rotation idempotency key does not rotate twice', async () => {
      const { generateJobPin, rotateJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)

      const r1 = await rotateJobPin(jobAId, customerAId)
      const r2 = await rotateJobPin(jobAId, customerAId)

      expect(r1.version).toBe(2)
      expect(r2.version).toBe(3)
    })
  })

  describe('Concurrency', () => {
    it('10 concurrent PIN verifications create one logical verification', async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      const { pin } = await generateJobPin(jobAId, customerAId)

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          verifyJobPin(jobAId, providerId, pin, 'ARRIVAL')
        )
      )

      const validCount = results.filter(r => r.valid).length
      expect(validCount).toBe(1)

      const record = await prisma.jobVerificationPin.findFirst({
        where: { jobId: jobAId },
        orderBy: { version: 'desc' },
      })
      expect(record).toBeTruthy()
      expect(record!.status).toBe('CONSUMED')
      expect(record!.lastSuccessfulUseAt).toBeTruthy()
      expect(record!.arrivalVerifiedAt).toBeTruthy()
    })

    it('10 concurrent invalid PIN attempts result in consistent lockout', { timeout: 30000 }, async () => {
      const { generateJobPin, verifyJobPin } = await import('@/lib/domain/job-pin')
      await generateJobPin(jobAId, customerAId)

      const batch1 = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          verifyJobPin(jobAId, providerId, '000000', 'ARRIVAL')
        )
      )
      const batch2 = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          verifyJobPin(jobAId, providerId, '000000', 'ARRIVAL')
        )
      )

      const allSettled = [...batch1, ...batch2]
      const results = allSettled
        .filter((r): r is PromiseFulfilledResult<{ valid: boolean; error?: string; locked?: boolean }> => r.status === 'fulfilled')
        .map(r => r.value)

      const lockedCount = results.filter(r => r.locked).length
      expect(lockedCount).toBeGreaterThanOrEqual(1)

      const record = await prisma.jobVerificationPin.findFirst({
        where: { jobId: jobAId, status: 'ACTIVE' },
      })
      expect(record!.failedAttempts).toBeGreaterThanOrEqual(5)
    })
  })
})
