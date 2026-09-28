import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'

const DATABASE_URL = process.env.DATABASE_URL || ''
const isTestDb = DATABASE_URL.includes('maintainex_test') || DATABASE_URL.includes('_ci')
const prisma = new PrismaClient()
const prefix = `release-payment-intent-${Date.now()}`

let customerId = ''
let providerId = ''
let categoryId = ''
let jobId = ''
let quoteId = ''
let escrowId = ''

describe.skipIf(!isTestDb)('Release gate — PaymentIntent concurrency', () => {
  beforeAll(async () => {
    customerId = `${prefix}-customer`
    providerId = `${prefix}-provider`
    categoryId = `${prefix}-category`
    jobId = `${prefix}-job`
    quoteId = `${prefix}-quote`
    escrowId = `${prefix}-escrow`

    await prisma.user.createMany({
      data: [
        {
          id: customerId,
          email: `${prefix}-customer@test.local`,
          passwordHash: 'test',
          name: 'Payment Customer',
          role: 'CUSTOMER',
          countryCode: 'LK',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: providerId,
          email: `${prefix}-provider@test.local`,
          passwordHash: 'test',
          name: 'Payment Provider',
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
        iconName: 'card',
        colorHex: '#000000',
        countries: 'LK',
      },
    })

    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId,
        title: 'Payment intent race',
        description: 'Ensure only one active checkout exists',
        categoryId,
        photos: '[]',
        budgetType: 'FIXED',
        status: 'QUOTE_ACCEPTED',
        countryCode: 'LK',
        approvedQuoteId: quoteId,
      },
    })

    await prisma.jobQuote.create({
      data: {
        id: quoteId,
        jobId,
        providerId,
        providerType: 'INDIVIDUAL',
        price: 500000n,
        estimatedCompletionTime: '2 hours',
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
        providerId,
        amount: 500000n,
        serviceFee: 50000n,
        totalAmount: 550000n,
        currency: 'LKR',
        paymentMethod: 'CARD',
        status: 'PENDING_PAYMENT',
      },
    })
  })

  afterAll(async () => {
    await prisma.paymentIntent.deleteMany({ where: { jobId } }).catch(() => {})
    await prisma.jobEscrow.deleteMany({ where: { id: escrowId } }).catch(() => {})
    await prisma.jobQuote.deleteMany({ where: { id: quoteId } }).catch(() => {})
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } }).catch(() => {})
    await prisma.jobCategory.deleteMany({ where: { id: categoryId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [customerId, providerId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('allows exactly one active PaymentIntent per job under concurrent creation', async () => {
    const create = (suffix: string) => prisma.paymentIntent.create({
      data: {
        jobId,
        customerId,
        escrowId,
        merchantOrderId: `${prefix}-order-${suffix}`,
        amount: 550000n,
        currency: 'LKR',
        status: 'PENDING',
      },
    })

    const results = await Promise.allSettled([create('a'), create('b')])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)

    const active = await prisma.paymentIntent.findMany({
      where: { jobId, status: { in: ['CREATED', 'PENDING'] } },
    })
    expect(active).toHaveLength(1)
  })
})
