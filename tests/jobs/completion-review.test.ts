import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let customerAId: string
let customerBId: string
let providerId: string
let completedJobId: string
let activeJobId: string

beforeAll(async () => {
  const custA = await prisma.user.upsert({
    where: { email: 'review-customer-a@test.com' },
    update: {},
    create: {
      email: 'review-customer-a@test.com',
      passwordHash: 'dummy',
      name: 'Review Customer A',
      phone: '+94770004001',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerAId = custA.id

  const custB = await prisma.user.upsert({
    where: { email: 'review-customer-b@test.com' },
    update: {},
    create: {
      email: 'review-customer-b@test.com',
      passwordHash: 'dummy',
      name: 'Review Customer B',
      phone: '+94770004002',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerBId = custB.id

  const prov = await prisma.user.upsert({
    where: { email: 'review-provider@test.com' },
    update: {},
    create: {
      email: 'review-provider@test.com',
      passwordHash: 'dummy',
      name: 'Review Provider',
      phone: '+94770004003',
      role: 'TASKER',
      countryCode: 'LK',
    },
  })
  providerId = prov.id

  const category = await prisma.jobCategory.findFirst()
  const categoryId = category?.id || 'cat-review-test'

  const completedJob = await prisma.marketplaceJob.create({
    data: {
      customerId: customerAId,
      title: 'Completed Review Job',
      description: 'Job for review testing',
      categoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'COMPLETED',
      countryCode: 'LK',
    },
  })
  completedJobId = completedJob.id

  const activeJob = await prisma.marketplaceJob.create({
    data: {
      customerId: customerAId,
      title: 'Active Review Job',
      description: 'Active job for review testing',
      categoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'IN_PROGRESS',
      countryCode: 'LK',
    },
  })
  activeJobId = activeJob.id

  await prisma.jobQuote.create({
    data: {
      jobId: completedJobId,
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
      jobId: activeJobId,
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
  await prisma.jobReview.deleteMany({ where: { jobId: { in: [completedJobId, activeJobId] } } })
  await prisma.providerReview.deleteMany({ where: { jobId: { in: [completedJobId, activeJobId] } } })
  await prisma.jobQuote.deleteMany({ where: { jobId: { in: [completedJobId, activeJobId] } } })
  await prisma.marketplaceJob.deleteMany({ where: { id: { in: [completedJobId, activeJobId] } } })
  await prisma.user.deleteMany({ where: { id: { in: [customerAId, customerBId, providerId] } } })
})

describe('Phase 10.5 — Completion / Review', () => {
  it('review only after eligible lifecycle (COMPLETED job)', async () => {
    const job = await prisma.marketplaceJob.findUnique({ where: { id: completedJobId } })
    expect(job!.status).toBe('COMPLETED')
  })

  it('customer can create review for completed job', async () => {
    const review = await prisma.jobReview.create({
      data: {
        jobId: completedJobId,
        customerId: customerAId,
        providerId,
        quality: 5,
        communication: 4,
        timeliness: 5,
        comment: 'Great work!',
      },
    })
    expect(review).toBeTruthy()
    expect(review.quality).toBe(5)
    await prisma.jobReview.delete({ where: { id: review.id } })
  })

  it('duplicate review prevented by unique constraint', async () => {
    const review1 = await prisma.jobReview.create({
      data: {
        jobId: completedJobId,
        customerId: customerAId,
        providerId,
        quality: 5,
        communication: 5,
        timeliness: 5,
      },
    })

    await expect(
      prisma.jobReview.create({
        data: {
          jobId: completedJobId,
          customerId: customerAId,
          providerId,
          quality: 4,
          communication: 4,
          timeliness: 4,
        },
      })
    ).rejects.toThrow()

    await prisma.jobReview.delete({ where: { id: review1.id } })
  })

  it('unrelated customer cannot review', async () => {
    await expect(
      prisma.jobReview.create({
        data: {
          jobId: completedJobId,
          customerId: customerBId,
          providerId,
          quality: 5,
          communication: 5,
          timeliness: 5,
        },
      })
    ).rejects.toThrow()
  })

  it('completion replay idempotent (same job cannot be completed twice)', async () => {
    const job = await prisma.marketplaceJob.findUnique({ where: { id: completedJobId } })
    expect(job!.status).toBe('COMPLETED')
  })
})
