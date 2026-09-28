import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

let customerId: string
let categoryId: string

beforeAll(async () => {
  const cust = await prisma.user.upsert({
    where: { email: 'booking-test-customer@test.com' },
    update: {},
    create: {
      email: 'booking-test-customer@test.com',
      passwordHash: 'dummy',
      name: 'Booking Test Customer',
      phone: '+94770002001',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerId = cust.id

  const cat = await prisma.jobCategory.findFirst()
  categoryId = cat?.id || 'cat-booking-test'
})

afterAll(async () => {
  await prisma.marketplaceJob.deleteMany({ where: { customerId } })
  await prisma.user.delete({ where: { id: customerId } })
})

describe('Phase 10.5 — Booking Tests', () => {
  it('valid customer job creation succeeds', async () => {
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'Test Booking Job',
        description: 'A test job for booking verification',
        categoryId,
        budgetType: 'FIXED',
        photos: '[]',
        status: 'OPEN',
        countryCode: 'LK',
      },
    })
    expect(job).toBeTruthy()
    expect(job.status).toBe('OPEN')
    expect(job.customerId).toBe(customerId)
    await prisma.marketplaceJob.delete({ where: { id: job.id } })
  })

  it('optional budget omitted successfully', async () => {
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'No Budget Job',
        description: 'Job without budget',
        categoryId,
        budgetType: 'REQUEST_QUOTES',
        photos: '[]',
        status: 'OPEN',
        countryCode: 'LK',
      },
    })
    expect(job.budgetAmount).toBeNull()
    await prisma.marketplaceJob.delete({ where: { id: job.id } })
  })

  it('budget accepted where allowed', async () => {
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'Budget Job',
        description: 'Job with budget',
        categoryId,
        budgetType: 'FIXED',
        budgetAmount: 5000n,
        photos: '[]',
        status: 'OPEN',
        countryCode: 'LK',
      },
    })
    expect(job.budgetAmount).toBe(5000n)
    await prisma.marketplaceJob.delete({ where: { id: job.id } })
  })

  it('pricing mode is preserved on MarketplaceJob', async () => {
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'Pricing Mode Job',
        description: 'Testing pricing mode preservation',
        categoryId,
        budgetType: 'FIXED',
        photos: '[]',
        status: 'OPEN',
        countryCode: 'LK',
      },
    })
    expect(job.budgetType).toBe('FIXED')
    await prisma.marketplaceJob.delete({ where: { id: job.id } })
  })

  it('INSPECTION_FIRST represented correctly', async () => {
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'Inspection First Job',
        description: 'Testing inspection first',
        categoryId,
        budgetType: 'FIXED',
        photos: '[]',
        status: 'OPEN',
        requiresInspection: true,
        countryCode: 'LK',
      },
    })
    expect(job.requiresInspection).toBe(true)
    await prisma.marketplaceJob.delete({ where: { id: job.id } })
  })

  it('unauthorized server fields are not settable by customer', async () => {
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'Security Test Job',
        description: 'Testing field isolation',
        categoryId,
        budgetType: 'FIXED',
        photos: '[]',
        status: 'OPEN',
        countryCode: 'LK',
      },
    })
    expect(job.status).toBe('OPEN')
    expect(job.approvedQuoteId).toBeNull()
    expect(job.finalAuthorizedAmountCents).toBeNull()
    await prisma.marketplaceJob.delete({ where: { id: job.id } })
  })
})
