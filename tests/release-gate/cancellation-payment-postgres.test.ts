import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { cancelJob } from '@/lib/domain/job-lifecycle'

const DATABASE_URL = process.env.DATABASE_URL || ''
const isTestDb = DATABASE_URL.includes('maintainex_test') || DATABASE_URL.includes('_ci')
const prisma = new PrismaClient()
const prefix = `release-cancel-${Date.now()}`

let customerId = ''
let acceptedProviderId = ''
let outsiderProviderId = ''
let categoryId = ''
let jobId = ''
let quoteId = ''
let escrowId = ''
let paymentIntentId = ''

describe.skipIf(!isTestDb)('Release gate — cancellation/payment serialization', () => {
  beforeAll(async () => {
    customerId = `${prefix}-customer`
    acceptedProviderId = `${prefix}-provider`
    outsiderProviderId = `${prefix}-outsider`
    categoryId = `${prefix}-category`
    jobId = `${prefix}-job`
    quoteId = `${prefix}-quote`
    escrowId = `${prefix}-escrow`
    paymentIntentId = `${prefix}-payment`

    await prisma.user.createMany({
      data: [
        {
          id: customerId,
          email: `${prefix}-customer@test.local`,
          passwordHash: 'test',
          name: 'Release Customer',
          role: 'CUSTOMER',
          countryCode: 'LK',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: acceptedProviderId,
          email: `${prefix}-provider@test.local`,
          passwordHash: 'test',
          name: 'Release Provider',
          role: 'TASKER',
          countryCode: 'LK',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: outsiderProviderId,
          email: `${prefix}-outsider@test.local`,
          passwordHash: 'test',
          name: 'Release Outsider',
          role: 'TASKER',
          countryCode: 'LK',
          isActive: true,
          updatedAt: new Date(),
        },
      ],
    })

    await prisma.jobCategory.create({
      data: {
        id: categoryId,
        name: `${prefix} category`,
        slug: `${prefix}-category`,
        iconName: 'wrench',
        colorHex: '#000000',
        countries: 'LK',
      },
    })

    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId,
        title: 'Release cancellation test',
        description: 'Verify provider authority and payment cancellation',
        categoryId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 10000n,
        status: 'QUOTE_ACCEPTED',
        countryCode: 'LK',
        approvedQuoteId: quoteId,
      },
    })

    await prisma.jobQuote.create({
      data: {
        id: quoteId,
        jobId,
        providerId: acceptedProviderId,
        providerType: 'INDIVIDUAL',
        price: 10000n,
        estimatedCompletionTime: '1 hour',
        attachments: '[]',
        status: 'ACCEPTED',
      },
    })

    await prisma.jobEscrow.create({
      data: {
        id: escrowId,
        jobId,
        quoteId,
        customerId,
        providerId: acceptedProviderId,
        amount: 10000n,
        serviceFee: 0n,
        totalAmount: 10000n,
        paymentMethod: 'CARD',
        currency: 'LKR',
        status: 'PENDING_PAYMENT',
      },
    })

    await prisma.paymentIntent.create({
      data: {
        id: paymentIntentId,
        jobId,
        customerId,
        escrowId,
        merchantOrderId: `${prefix}-order`,
        amount: 10000n,
        currency: 'LKR',
        status: 'PENDING',
      },
    })
  })

  afterAll(async () => {
    await prisma.paymentIntent.deleteMany({ where: { id: paymentIntentId } }).catch(() => {})
    await prisma.jobEscrow.deleteMany({ where: { id: escrowId } }).catch(() => {})
    await prisma.jobQuote.deleteMany({ where: { id: quoteId } }).catch(() => {})
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } }).catch(() => {})
    await prisma.jobCategory.deleteMany({ where: { id: categoryId } }).catch(() => {})
    await prisma.user.deleteMany({
      where: { id: { in: [customerId, acceptedProviderId, outsiderProviderId] } },
    }).catch(() => {})
    await prisma.$disconnect()
  })

  it('rejects an unrelated provider at the domain boundary', async () => {
    await expect(
      cancelJob({
        jobId,
        actorId: outsiderProviderId,
        actorType: 'PROVIDER',
      })
    ).rejects.toThrow('Only the accepted provider can cancel this job')

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect(job?.status).toBe('QUOTE_ACCEPTED')
  })

  it('accepted provider cancellation atomically closes job, pending escrow, and payment intent', async () => {
    const result = await cancelJob({
      jobId,
      actorId: acceptedProviderId,
      actorType: 'PROVIDER',
    })

    expect(result.previousStatus).toBe('QUOTE_ACCEPTED')

    const [job, escrow, payment, quote] = await Promise.all([
      prisma.marketplaceJob.findUnique({ where: { id: jobId } }),
      prisma.jobEscrow.findUnique({ where: { id: escrowId } }),
      prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } }),
      prisma.jobQuote.findUnique({ where: { id: quoteId } }),
    ])

    expect(job?.status).toBe('CANCELLED')
    expect(job?.isActive).toBe(false)
    expect(escrow?.status).toBe('CANCELLED')
    expect(payment?.status).toBe('CANCELLED')
    expect(quote?.status).toBe('WITHDRAWN')
  })
})
