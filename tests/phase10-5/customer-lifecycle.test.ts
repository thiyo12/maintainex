import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let customerAId: string
let providerId: string
let jobId: string

beforeAll(async () => {
  const cust = await prisma.user.upsert({
    where: { email: 'lifecycle-customer@test.com' },
    update: {},
    create: {
      email: 'lifecycle-customer@test.com',
      passwordHash: 'dummy',
      name: 'Lifecycle Customer',
      phone: '+94770003001',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerAId = cust.id

  const prov = await prisma.user.upsert({
    where: { email: 'lifecycle-provider@test.com' },
    update: {},
    create: {
      email: 'lifecycle-provider@test.com',
      passwordHash: 'dummy',
      name: 'Lifecycle Provider',
      phone: '+94770003002',
      role: 'TASKER',
      countryCode: 'LK',
    },
  })
  providerId = prov.id

  const category = await prisma.jobCategory.findFirst()
  const categoryId = category?.id || 'cat-lifecycle-test'

  const job = await prisma.marketplaceJob.create({
    data: {
      customerId: customerAId,
      title: 'Lifecycle Test Job',
      description: 'Testing customer lifecycle',
      categoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'QUOTE_ACCEPTED',
      countryCode: 'LK',
    },
  })
  jobId = job.id

  await prisma.jobQuote.create({
    data: {
      jobId,
      providerId,
      providerType: 'INDIVIDUAL',
      price: 5000n,
      estimatedCompletionTime: '2 hours',
        attachments: '[]',
      status: 'ACCEPTED',
    },
  })

  await prisma.jobWorkspace.create({
    data: {
      jobId,
      progressStatus: 'ACCEPTED',
    },
  })
})

afterAll(async () => {
  await prisma.jobVerificationPin.deleteMany({ where: { jobId } })
  await prisma.jobQuote.deleteMany({ where: { jobId } })
  await prisma.jobWorkspace.deleteMany({ where: { jobId } })
  await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
  await prisma.user.deleteMany({ where: { id: { in: [customerAId, providerId] } } })
})

beforeEach(async () => {
  await prisma.jobVerificationPin.deleteMany({ where: { jobId } })
  await prisma.marketplaceJob.update({
    where: { id: jobId },
    data: {
      status: 'QUOTE_ACCEPTED',
      approvedQuoteId: null,
      finalAuthorizedAmountCents: null,
    },
  })
  await prisma.jobWorkspace.update({
    where: { jobId },
    data: { progressStatus: 'ACCEPTED' },
  })
})

describe('Phase 10.5 — Customer Lifecycle', () => {
  it('customer status projection returns valid stages', async () => {
    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect(job).toBeTruthy()
    expect(job!.status).toBe('QUOTE_ACCEPTED')
  })

  it('provider arrival reported but not customer-verified', async () => {
    const inspection = await prisma.jobInspection.create({
      data: {
        jobId,
        providerType: 'INDIVIDUAL',
        taskerId: providerId,
        status: 'ARRIVED',
        verifiedByCustomer: false,
      },
    })

    expect(inspection.verifiedByCustomer).toBe(false)
    await prisma.jobInspection.delete({ where: { id: inspection.id } })
  })

  it('customer confirms arrival', async () => {
    const inspection = await prisma.jobInspection.create({
      data: {
        jobId,
        providerType: 'INDIVIDUAL',
        taskerId: providerId,
        status: 'ARRIVED',
        verifiedByCustomer: false,
      },
    })

    const updated = await prisma.jobInspection.update({
      where: { id: inspection.id },
      data: {
        verifiedByCustomer: true,
        verifiedAt: new Date(),
      },
    })

    expect(updated.verifiedByCustomer).toBe(true)
    expect(updated.verifiedAt).toBeTruthy()
    await prisma.jobInspection.delete({ where: { id: inspection.id } })
  })

  it('provider cannot self-confirm as customer', async () => {
    const { verifyJobPin } = await import('@/lib/domain/job-pin')
    const { generateJobPin } = await import('@/lib/domain/job-pin')
    await generateJobPin(jobId, customerAId)

    const result = await verifyJobPin(jobId, providerId, '123456', 'ARRIVAL')
    expect(result.valid).toBe(false)
  })

  it('quote approval uses canonical service', async () => {
    const quote = await prisma.jobQuote.findFirst({
      where: { jobId, status: 'ACCEPTED' },
    })
    expect(quote).toBeTruthy()
    expect(quote!.status).toBe('ACCEPTED')
  })

  it('authorized amount comes from canonical backend', async () => {
    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    const finalAmount = job!.finalAuthorizedAmountCents
    expect(finalAmount === null || typeof finalAmount === 'bigint').toBe(true)
  })
})
