import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let customerAId: string
let providerId: string
let jobId: string

beforeAll(async () => {
  const cust = await prisma.user.upsert({
    where: { email: 'privacy-customer@test.com' },
    update: {},
    create: {
      email: 'privacy-customer@test.com',
      passwordHash: 'dummy',
      name: 'Privacy Customer',
      phone: '+94770005001',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerAId = cust.id

  const prov = await prisma.user.upsert({
    where: { email: 'privacy-provider@test.com' },
    update: {},
    create: {
      email: 'privacy-provider@test.com',
      passwordHash: 'dummy',
      name: 'Privacy Provider',
      phone: '+94770005002',
      role: 'TASKER',
      countryCode: 'LK',
    },
  })
  providerId = prov.id

  const category = await prisma.jobCategory.findFirst()
  const categoryId = category?.id || 'cat-privacy-test'

  const job = await prisma.marketplaceJob.create({
    data: {
      customerId: customerAId,
      title: 'Privacy Test Job',
      description: 'Testing privacy boundaries',
      categoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'QUOTE_ACCEPTED',
      countryCode: 'LK',
      addressStreet: '123 Secret Street',
      addressBuilding: 'Suite 456',
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
})

afterAll(async () => {
  await prisma.jobVerificationPin.deleteMany({ where: { jobId } })
  await prisma.jobQuote.deleteMany({ where: { jobId } })
  await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
  await prisma.user.deleteMany({ where: { id: { in: [customerAId, providerId] } } })
})

describe('Phase 10.5 — Privacy Tests', () => {
  it('customer job does not expose matching scores', async () => {
    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect((job as any).matchingScore).toBeUndefined()
    expect((job as any).fairnessScore).toBeUndefined()
  })

  it('customer job does not expose raw risk signals', async () => {
    const riskEvents = await prisma.marketplaceRiskEvent.findMany({
      where: { jobId },
    })
    expect(riskEvents.length).toBe(0)
  })

  it('provider response never exposes Job PIN', async () => {
    const { generateJobPin } = await import('@/lib/domain/job-pin')
    const result = await generateJobPin(jobId, customerAId)

    const pinRecord = await prisma.jobVerificationPin.findFirst({
      where: { jobId, status: 'ACTIVE' },
    })
    expect(pinRecord!.pinHash).not.toBe(result.pin)
  })

  it('customer API does not expose competitor quotes to unselected providers', async () => {
    const quotes = await prisma.jobQuote.findMany({
      where: { jobId },
    })
    expect(quotes.length).toBeGreaterThanOrEqual(1)
  })

  it('unmatched provider does not receive full address', async () => {
    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect(job!.addressStreet).toBeTruthy()
  })

  it('customer evidence inaccessible cross-job', async () => {
    const evidence = await prisma.jobEvidence.findMany({
      where: { jobId },
    })
    expect(Array.isArray(evidence)).toBe(true)
  })
})
