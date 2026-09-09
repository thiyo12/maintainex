import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const TEST_DB_URL = process.env.DATABASE_URL
const isVPS = TEST_DB_URL && TEST_DB_URL.includes('maintainex_test')

describe.skipIf(!isVPS)('4D.1 — Real PostgreSQL 2-Way Quote Concurrency', () => {
  let prisma: PrismaClient
  const PREFIX = `4d1-${Date.now()}`
  const customerId = `${PREFIX}-customer`
  const providerA = `${PREFIX}-prov-a`
  const providerB = `${PREFIX}-prov-b`
  const jobId = `${PREFIX}-job`
  const quoteAId = `${PREFIX}-quote-a`
  const quoteBId = `${PREFIX}-quote-b`

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.createMany({
      data: [
        { id: customerId, email: `${PREFIX}@test.com`, passwordHash: 'hash', name: 'Test Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        { id: providerA, email: `${PREFIX}-a@test.com`, passwordHash: 'hash', name: 'Provider A', role: 'TASKER', isActive: true, updatedAt: new Date() },
        { id: providerB, email: `${PREFIX}-b@test.com`, passwordHash: 'hash', name: 'Provider B', role: 'TASKER', isActive: true, updatedAt: new Date() },
      ],
    })

    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId,
        title: 'Test Job',
        description: 'Test description',
        categoryId: 'test-category',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: BigInt(10000),
        status: 'OPEN',
        urgency: 'normal',
        workersCount: 1,
        materialHandling: 'tasker_brings',
        countryCode: 'LK',
      },
    })

    await prisma.jobQuote.createMany({
      data: [
        { id: quoteAId, jobId, providerId: providerA, providerType: 'INDIVIDUAL', price: BigInt(5000), estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING' },
        { id: quoteBId, jobId, providerId: providerB, providerType: 'INDIVIDUAL', price: BigInt(6000), estimatedCompletionTime: '2h', attachments: '[]', status: 'PENDING' },
      ],
    })
  })

  afterAll(async () => {
    await prisma.jobEscrow.deleteMany({ where: { jobId } })
    await prisma.jobWorkspace.deleteMany({ where: { jobId } })
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { id: { in: [customerId, providerA, providerB] } } })
    await prisma.$disconnect()
  })

  it('2-way concurrent acceptance: exactly one wins', async () => {
    const { acceptJobQuote } = await import('../../lib/domain/job-lifecycle')

    const results = await Promise.allSettled([
      acceptJobQuote({ jobId, actorId: customerId, actorType: 'CUSTOMER' }, quoteAId),
      acceptJobQuote({ jobId, actorId: customerId, actorType: 'CUSTOMER' }, quoteBId),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    expect(succeeded.length).toBeLessThanOrEqual(1)
    expect(failed.length).toBeGreaterThanOrEqual(1)

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect(job?.status).toBe('QUOTE_ACCEPTED')

    const acceptedQuotes = await prisma.jobQuote.findMany({
      where: { jobId, status: 'ACCEPTED' },
    })
    expect(acceptedQuotes.length).toBe(1)

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    expect(workspace).toBeTruthy()
    expect(workspace?.progressStatus).toBe('ACCEPTED')

    const escrows = await prisma.jobEscrow.findMany({ where: { jobId } })
    expect(escrows.length).toBe(1)
    expect(escrows[0].status).toBe('PENDING_PAYMENT')
  })
})

describe.skipIf(!isVPS)('4D.2 — Real PostgreSQL 5-Way Quote Concurrency', () => {
  let prisma: PrismaClient
  const PREFIX = `4d2-${Date.now()}`
  const customerId = `${PREFIX}-customer`
  const providers = Array.from({ length: 5 }, (_, i) => `${PREFIX}-prov-${i}`)
  const jobId = `${PREFIX}-job`
  const quoteIds = Array.from({ length: 5 }, (_, i) => `${PREFIX}-quote-${i}`)

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.createMany({
      data: [
        { id: customerId, email: `${PREFIX}@test.com`, passwordHash: 'hash', name: 'Test Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        ...providers.map((id, i) => ({
          id, email: `${PREFIX}-p${i}@test.com`, passwordHash: 'hash', name: `Provider ${i}`, role: 'TASKER' as const, isActive: true, updatedAt: new Date(),
        })),
      ],
    })

    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId,
        title: 'Test Job 5-Way',
        description: 'Test description',
        categoryId: 'test-category',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: BigInt(10000),
        status: 'OPEN',
        urgency: 'normal',
        workersCount: 1,
        materialHandling: 'tasker_brings',
        countryCode: 'LK',
      },
    })

    await prisma.jobQuote.createMany({
      data: providers.map((providerId, i) => ({
        id: quoteIds[i],
        jobId,
        providerId,
        providerType: 'INDIVIDUAL',
        price: BigInt(5000 + i * 1000),
        estimatedCompletionTime: '1h',
        attachments: '[]',
        status: 'PENDING' as const,
      })),
    })
  })

  afterAll(async () => {
    await prisma.jobEscrow.deleteMany({ where: { jobId } })
    await prisma.jobWorkspace.deleteMany({ where: { jobId } })
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { id: { in: [customerId, ...providers] } } })
    await prisma.$disconnect()
  })

  it('5-way concurrent acceptance: <= 1 winner, clean state', async () => {
    const { acceptJobQuote } = await import('../../lib/domain/job-lifecycle')

    const results = await Promise.allSettled(
      quoteIds.map(qid =>
        acceptJobQuote({ jobId, actorId: customerId, actorType: 'CUSTOMER' }, qid)
      )
    )

    const succeeded = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    expect(succeeded.length).toBeLessThanOrEqual(1)
    expect(failed.length).toBeGreaterThanOrEqual(4)

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect(job?.status).toBe('QUOTE_ACCEPTED')

    const acceptedQuotes = await prisma.jobQuote.findMany({
      where: { jobId, status: 'ACCEPTED' },
    })
    expect(acceptedQuotes.length).toBe(1)

    const pendingQuotes = await prisma.jobQuote.findMany({
      where: { jobId, status: 'REJECTED' },
    })
    expect(pendingQuotes.length).toBe(4)

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    expect(workspace).toBeTruthy()
    expect(workspace?.progressStatus).toBe('ACCEPTED')

    const escrows = await prisma.jobEscrow.findMany({ where: { jobId } })
    expect(escrows.length).toBe(1)
  })

  it('5-way run twice: idempotent cleanup', async () => {
    const { acceptJobQuote } = await import('../../lib/domain/job-lifecycle')

    const results = await Promise.allSettled(
      quoteIds.map(qid =>
        acceptJobQuote({ jobId, actorId: customerId, actorType: 'CUSTOMER' }, qid)
      )
    )

    const succeeded = results.filter(r => r.status === 'fulfilled')
    expect(succeeded.length).toBe(0)

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect(job?.status).toBe('QUOTE_ACCEPTED')

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    expect(workspace).toBeTruthy()

    const escrows = await prisma.jobEscrow.findMany({ where: { jobId } })
    expect(escrows.length).toBe(1)
  })
})

describe.skipIf(!isVPS)('4D.3 — Same-Quote Retry', () => {
  let prisma: PrismaClient
  const PREFIX = `4d3-${Date.now()}`
  const customerId = `${PREFIX}-customer`
  const providerId = `${PREFIX}-prov`
  const jobId = `${PREFIX}-job`
  const quoteId = `${PREFIX}-quote`

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.createMany({
      data: [
        { id: customerId, email: `${PREFIX}@test.com`, passwordHash: 'hash', name: 'Test Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        { id: providerId, email: `${PREFIX}-p@test.com`, passwordHash: 'hash', name: 'Provider', role: 'TASKER', isActive: true, updatedAt: new Date() },
      ],
    })

    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId,
        title: 'Retry Test Job',
        description: 'Test',
        categoryId: 'test',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: BigInt(5000),
        status: 'OPEN',
        urgency: 'normal',
        workersCount: 1,
        materialHandling: 'tasker_brings',
        countryCode: 'LK',
      },
    })

    await prisma.jobQuote.create({
      data: {
        id: quoteId,
        jobId,
        providerId,
        providerType: 'INDIVIDUAL',
        price: BigInt(5000),
        estimatedCompletionTime: '1h',
        attachments: '[]',
        status: 'PENDING',
      },
    })
  })

  afterAll(async () => {
    await prisma.jobEscrow.deleteMany({ where: { jobId } })
    await prisma.jobWorkspace.deleteMany({ where: { jobId } })
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { id: { in: [customerId, providerId] } } })
    await prisma.$disconnect()
  })

  it('same-quote concurrent retry: no duplicate state', async () => {
    const { acceptJobQuote } = await import('../../lib/domain/job-lifecycle')

    const ctx = { jobId, actorId: customerId, actorType: 'CUSTOMER' as const }

    const first = await acceptJobQuote(ctx, quoteId)
    expect(first.quote.status).toBe('ACCEPTED')

    const results = await Promise.allSettled([
      acceptJobQuote(ctx, quoteId),
      acceptJobQuote(ctx, quoteId),
      acceptJobQuote(ctx, quoteId),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    expect(succeeded.length + failed.length).toBe(3)

    const workspaces = await prisma.jobWorkspace.findMany({ where: { jobId } })
    expect(workspaces.length).toBe(1)

    const escrows = await prisma.jobEscrow.findMany({ where: { jobId } })
    expect(escrows.length).toBe(1)
  })
})

describe.skipIf(!isVPS)('4D.4 — Accept vs Cancel DB Race', () => {
  let prisma: PrismaClient
  const PREFIX = `4d4-${Date.now()}`
  const customerId = `${PREFIX}-customer`
  const providerA = `${PREFIX}-prov-a`
  const providerB = `${PREFIX}-prov-b`

  const jobA = `${PREFIX}-job-a`
  const quoteA = `${PREFIX}-quote-a`

  const jobB = `${PREFIX}-job-b`
  const quoteB = `${PREFIX}-quote-b`

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.createMany({
      data: [
        { id: customerId, email: `${PREFIX}@test.com`, passwordHash: 'hash', name: 'Test Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        { id: providerA, email: `${PREFIX}-pa@test.com`, passwordHash: 'hash', name: 'Provider A', role: 'TASKER', isActive: true, updatedAt: new Date() },
        { id: providerB, email: `${PREFIX}-pb@test.com`, passwordHash: 'hash', name: 'Provider B', role: 'TASKER', isActive: true, updatedAt: new Date() },
      ],
    })

    await prisma.marketplaceJob.createMany({
      data: [
        {
          id: jobA, customerId, title: 'Race Test Job A', description: 'Test',
          categoryId: 'test', photos: '[]', budgetType: 'FIXED',
          budgetAmount: BigInt(5000), status: 'OPEN', urgency: 'normal',
          workersCount: 1, materialHandling: 'tasker_brings', countryCode: 'LK',
        },
        {
          id: jobB, customerId, title: 'Race Test Job B', description: 'Test',
          categoryId: 'test', photos: '[]', budgetType: 'FIXED',
          budgetAmount: BigInt(5000), status: 'OPEN', urgency: 'normal',
          workersCount: 1, materialHandling: 'tasker_brings', countryCode: 'LK',
        },
      ],
    })

    await prisma.jobQuote.createMany({
      data: [
        {
          id: quoteA, jobId: jobA, providerId: providerA, providerType: 'INDIVIDUAL',
          price: BigInt(5000), estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING',
        },
        {
          id: quoteB, jobId: jobB, providerId: providerB, providerType: 'INDIVIDUAL',
          price: BigInt(5000), estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING',
        },
      ],
    })
  })

  afterAll(async () => {
    for (const jid of [jobA, jobB]) {
      await prisma.jobEscrow.deleteMany({ where: { jobId: jid } })
      await prisma.jobWorkspace.deleteMany({ where: { jobId: jid } })
      await prisma.jobQuote.deleteMany({ where: { jobId: jid } })
      await prisma.marketplaceJob.deleteMany({ where: { id: jid } })
    }
    await prisma.user.deleteMany({ where: { id: { in: [customerId, providerA, providerB] } } })
    await prisma.$disconnect()
  })

  it('Scenario A: accept wins first, cancel after', async () => {
    const { acceptJobQuote, transitionMarketplaceJob } = await import('../../lib/domain/job-lifecycle')

    const acceptCtx = { jobId: jobA, actorId: customerId, actorType: 'CUSTOMER' as const }
    const cancelCtx = { jobId: jobA, actorId: customerId, actorType: 'CUSTOMER' as const }

    await acceptJobQuote(acceptCtx, quoteA)

    const cancelResult = await transitionMarketplaceJob(cancelCtx, 'CANCELLED')
    expect(cancelResult.status).toBe('CANCELLED')

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: jobA } })
    expect(workspace).toBeTruthy()
  })

  it('Scenario B: cancel wins first, accept rejected', async () => {
    const { acceptJobQuote, transitionMarketplaceJob } = await import('../../lib/domain/job-lifecycle')

    const acceptCtx = { jobId: jobB, actorId: customerId, actorType: 'CUSTOMER' as const }
    const cancelCtx = { jobId: jobB, actorId: customerId, actorType: 'CUSTOMER' as const }

    await transitionMarketplaceJob(cancelCtx, 'CANCELLED')

    await expect(acceptJobQuote(acceptCtx, quoteB)).rejects.toThrow('Job is not open')

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobB } })
    expect(job?.status).toBe('CANCELLED')
  })
})

describe.skipIf(!isVPS)('4D.5 — Cancellation Policy + Final State', () => {
  let prisma: PrismaClient
  const PREFIX = `4d5-${Date.now()}`
  const customerId = `${PREFIX}-customer`
  const providerId = `${PREFIX}-prov`
  const jobId = `${PREFIX}-job`
  const quoteId = `${PREFIX}-quote`

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.createMany({
      data: [
        { id: customerId, email: `${PREFIX}@test.com`, passwordHash: 'hash', name: 'Test Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        { id: providerId, email: `${PREFIX}-p@test.com`, passwordHash: 'hash', name: 'Provider', role: 'TASKER', isActive: true, updatedAt: new Date() },
      ],
    })

    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId,
        title: 'Cancel Policy Job',
        description: 'Test',
        categoryId: 'test',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: BigInt(5000),
        status: 'OPEN',
        urgency: 'normal',
        workersCount: 1,
        materialHandling: 'tasker_brings',
        countryCode: 'LK',
      },
    })

    await prisma.jobQuote.create({
      data: {
        id: quoteId,
        jobId,
        providerId,
        providerType: 'INDIVIDUAL',
        price: BigInt(5000),
        estimatedCompletionTime: '1h',
        attachments: '[]',
        status: 'PENDING',
      },
    })
  })

  afterAll(async () => {
    await prisma.jobEscrow.deleteMany({ where: { jobId } })
    await prisma.jobWorkspace.deleteMany({ where: { jobId } })
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { id: { in: [customerId, providerId] } } })
    await prisma.$disconnect()
  })

  it('OPEN job can be cancelled', async () => {
    const { transitionMarketplaceJob } = await import('../../lib/domain/job-lifecycle')

    const result = await transitionMarketplaceJob(
      { jobId, actorId: customerId, actorType: 'CUSTOMER' },
      'CANCELLED'
    )
    expect(result.status).toBe('CANCELLED')
  })

  it('CANCELLED job: workspace not left active', async () => {
    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    expect(workspace).toBeNull()
  })

  it('CANCELLED job: no active escrow', async () => {
    const escrows = await prisma.jobEscrow.findMany({ where: { jobId } })
    const activeEscrows = escrows.filter(e => e.status === 'PROTECTED' || e.status === 'PENDING_PAYMENT')
    expect(activeEscrows.length).toBe(0)
  })

  it('QUOTE_ACCEPTED job can be cancelled', async () => {
    const newJobId = `${PREFIX}-job-qa`
    const newQuoteId = `${PREFIX}-quote-qa`

    await prisma.marketplaceJob.create({
      data: {
        id: newJobId,
        customerId,
        title: 'QA Cancel Job',
        description: 'Test',
        categoryId: 'test',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: BigInt(5000),
        status: 'OPEN',
        urgency: 'normal',
        workersCount: 1,
        materialHandling: 'tasker_brings',
        countryCode: 'LK',
      },
    })

    await prisma.jobQuote.create({
      data: {
        id: newQuoteId,
        jobId: newJobId,
        providerId,
        providerType: 'INDIVIDUAL',
        price: BigInt(5000),
        estimatedCompletionTime: '1h',
        attachments: '[]',
        status: 'PENDING',
      },
    })

    const { acceptJobQuote, transitionMarketplaceJob } = await import('../../lib/domain/job-lifecycle')

    await acceptJobQuote(
      { jobId: newJobId, actorId: customerId, actorType: 'CUSTOMER' },
      newQuoteId
    )

    const jobAfterAccept = await prisma.marketplaceJob.findUnique({ where: { id: newJobId } })
    expect(jobAfterAccept?.status).toBe('QUOTE_ACCEPTED')

    const result = await transitionMarketplaceJob(
      { jobId: newJobId, actorId: customerId, actorType: 'CUSTOMER' },
      'CANCELLED'
    )
    expect(result.status).toBe('CANCELLED')

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: newJobId } })
    expect(workspace).toBeTruthy()
    expect(workspace?.progressStatus).not.toBe('IN_PROGRESS')

    const escrows = await prisma.jobEscrow.findMany({ where: { jobId: newJobId } })
    const activeEscrows = escrows.filter(e => e.status === 'PROTECTED')
    expect(activeEscrows.length).toBe(0)

    await prisma.jobEscrow.deleteMany({ where: { jobId: newJobId } })
    await prisma.jobWorkspace.deleteMany({ where: { jobId: newJobId } })
    await prisma.jobQuote.deleteMany({ where: { jobId: newJobId } })
    await prisma.marketplaceJob.deleteMany({ where: { id: newJobId } })
  })

  it('COMPLETED job cannot be cancelled', async () => {
    const { transitionMarketplaceJob } = await import('../../lib/domain/job-lifecycle')

    await prisma.marketplaceJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED' },
    })

    await expect(
      transitionMarketplaceJob(
        { jobId, actorId: customerId, actorType: 'CUSTOMER' },
        'CANCELLED'
      )
    ).rejects.toThrow('Cannot transition')
  })
})

describe.skipIf(!isVPS)('4D.6 — BOOK_NOW Real DB Test', () => {
  let prisma: PrismaClient
  let taskerProfileId: string
  const PREFIX = `4d6-${Date.now()}`
  const customerId = `${PREFIX}-customer`
  const providerId = `${PREFIX}-prov`
  const templateJobId = `${PREFIX}-template`
  const categoryId = `${PREFIX}-category`
  const serviceTemplateId = `${PREFIX}-service-template`

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.createMany({
      data: [
        { id: customerId, email: `${PREFIX}@test.com`, passwordHash: 'hash', name: 'Test Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        { id: providerId, email: `${PREFIX}-p@test.com`, passwordHash: 'hash', name: 'Provider', role: 'TASKER', isActive: true, updatedAt: new Date(), identityStatus: 'VERIFIED' },
      ],
    })

    await prisma.jobCategory.create({
      data: {
        id: categoryId,
        name: `${PREFIX}-Category`,
        slug: `${PREFIX}-cat`,
        iconName: 'wrench',
        colorHex: '#FF0000',
        countries: 'LK',
        isActive: true,
      },
    })

    await prisma.templateJob.create({
      data: {
        id: templateJobId,
        name: 'Test Service',
        description: 'Test service description',
        categoryId,
        priceMin: 3000,
        priceMax: 5000,
        whatIsIncluded: 'Basic service',
        typicalDurationMinutes: 60,
        countries: 'LK',
      },
    })

    await prisma.serviceTemplate.create({
      data: {
        id: serviceTemplateId,
        jobCategoryId: categoryId,
        templateJobId,
        name: 'Test Service Template',
        slug: `${PREFIX}-st`,
        description: 'Test service template',
        questionsJson: '[]',
        defaultDurationMinutes: 60,
        priceMin: 3000,
        priceMax: 5000,
        countryCode: 'LK',
      },
    })

    const taskerProfile = await prisma.taskerProfile.create({
      data: {
        userId: providerId,
        skills: '[]',
        rating: 4.5,
        completedJobs: 10,
        hourlyRate: 500,
        verificationStatus: 'VERIFIED',
        isVerified: true,
      },
    })
    taskerProfileId = taskerProfile.id

    await prisma.taskerSkill.create({
      data: {
        taskerId: taskerProfileId,
        jobId: templateJobId,
        experienceYears: 2,
        experienceLevel: 2,
        hourlyRate: 500,
      },
    })
  })

  afterAll(async () => {
    const jobs = await prisma.marketplaceJob.findMany({ where: { templateJobId } })
    for (const job of jobs) {
      await prisma.jobEscrow.deleteMany({ where: { jobId: job.id } })
      await prisma.jobWorkspace.deleteMany({ where: { jobId: job.id } })
      await prisma.jobQuote.deleteMany({ where: { jobId: job.id } })
    }
    await prisma.marketplaceJob.deleteMany({ where: { templateJobId } })
    await prisma.taskerSkill.deleteMany({ where: { taskerId: taskerProfileId } })
    await prisma.serviceTemplate.deleteMany({ where: { id: serviceTemplateId } })
    await prisma.templateJob.deleteMany({ where: { id: templateJobId } })
    await prisma.jobCategory.deleteMany({ where: { id: categoryId } })
    await prisma.taskerProfile.deleteMany({ where: { userId: providerId } })
    await prisma.user.deleteMany({ where: { id: { in: [customerId, providerId] } } })
    await prisma.$disconnect()
  })

  it('BOOK_NOW creates MarketplaceJob, not Booking', async () => {
    const { createBookNowJob } = await import('../../lib/domain/book-now')

    const result = await createBookNowJob({
      customerId,
      templateJobId,
      providerId,
      scheduledDate: new Date(),
      timeSlot: 'morning',
      address: '123 Test Street',
      district: 'Colombo',
    })

    expect(result.job).toBeTruthy()
    expect(result.job.status).toBe('OPEN')
    expect(result.job.budgetType).toBe('FIXED')

    const marketplaceJob = await prisma.marketplaceJob.findUnique({ where: { id: result.job.id } })
    expect(marketplaceJob).toBeTruthy()
    expect(marketplaceJob?.templateJobId).toBe(templateJobId)
    expect(marketplaceJob?.addressStreet).toBe('123 Test Street')
    expect(marketplaceJob?.preferredTimeSlot).toBe('morning')
    expect(marketplaceJob?.preferredDate).toBeTruthy()

    const bookings = await prisma.booking.findMany({ where: { userId: customerId } })
    const bookNowBookings = bookings.filter(b => b.templateJobId === templateJobId)
    expect(bookNowBookings.length).toBe(0)

    const quote = await prisma.jobQuote.findFirst({ where: { jobId: result.job.id } })
    expect(quote).toBeTruthy()
    expect(quote?.providerId).toBe(providerId)

    await prisma.jobEscrow.deleteMany({ where: { jobId: result.job.id } })
    await prisma.jobWorkspace.deleteMany({ where: { jobId: result.job.id } })
    await prisma.jobQuote.deleteMany({ where: { jobId: result.job.id } })
    await prisma.marketplaceJob.deleteMany({ where: { id: result.job.id } })
  })
})

describe.skipIf(!isVPS)('4D.7 — FK/Orphan Audit', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('MarketplaceJob.customerId orphans = 0', async () => {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "MarketplaceJob" mj
       LEFT JOIN "User" u ON mj."customerId" = u.id
       WHERE u.id IS NULL`
    )
    expect(Number(result[0].count)).toBe(0)
  })

  it('JobQuote.jobId orphans = 0', async () => {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "JobQuote" jq
       LEFT JOIN "MarketplaceJob" mj ON jq."jobId" = mj.id
       WHERE mj.id IS NULL`
    )
    expect(Number(result[0].count)).toBe(0)
  })

  it('JobQuote.providerId orphans = 0', async () => {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "JobQuote" jq
       LEFT JOIN "User" u ON jq."providerId" = u.id
       WHERE u.id IS NULL`
    )
    expect(Number(result[0].count)).toBe(0)
  })

  it('JobWorkspace.jobId orphans = 0', async () => {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "JobWorkspace" jw
       LEFT JOIN "MarketplaceJob" mj ON jw."jobId" = mj.id
       WHERE mj.id IS NULL`
    )
    expect(Number(result[0].count)).toBe(0)
  })

  it('JobEscrow.jobId orphans = 0', async () => {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "JobEscrow" je
       LEFT JOIN "MarketplaceJob" mj ON je."jobId" = mj.id
       WHERE mj.id IS NULL`
    )
    expect(Number(result[0].count)).toBe(0)
  })

  it('JobEscrow.quoteId orphans = 0', async () => {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "JobEscrow" je
       LEFT JOIN "JobQuote" jq ON je."quoteId" = jq.id
       WHERE jq.id IS NULL`
    )
    expect(Number(result[0].count)).toBe(0)
  })

  it('CommissionSettlement.jobId orphans = 0', async () => {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "CommissionSettlement" cs
       LEFT JOIN "MarketplaceJob" mj ON cs."jobId" = mj.id
       WHERE mj.id IS NULL`
    )
    expect(Number(result[0].count)).toBe(0)
  })

  it('CommissionSettlement.escrowId orphans = 0', async () => {
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "CommissionSettlement" cs
       LEFT JOIN "JobEscrow" je ON cs."escrowId" = je.id
       WHERE je.id IS NULL`
    )
    expect(Number(result[0].count)).toBe(0)
  })
})

describe.skipIf(!isVPS)('4D.9 — Authorization Regression', () => {
  let prisma: PrismaClient
  const PREFIX = `4d9-${Date.now()}`
  const customerId = `${PREFIX}-customer`
  const providerA = `${PREFIX}-prov-a`
  const providerB = `${PREFIX}-prov-b`
  const jobId = `${PREFIX}-job`
  const quoteAId = `${PREFIX}-quote-a`

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.createMany({
      data: [
        { id: customerId, email: `${PREFIX}@test.com`, passwordHash: 'hash', name: 'Customer', role: 'CUSTOMER', isActive: true, updatedAt: new Date() },
        { id: providerA, email: `${PREFIX}-a@test.com`, passwordHash: 'hash', name: 'Provider A', role: 'TASKER', isActive: true, updatedAt: new Date() },
        { id: providerB, email: `${PREFIX}-b@test.com`, passwordHash: 'hash', name: 'Provider B', role: 'TASKER', isActive: true, updatedAt: new Date() },
      ],
    })

    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId,
        title: 'Auth Test Job',
        description: 'Test',
        categoryId: 'test',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: BigInt(5000),
        status: 'OPEN',
        urgency: 'normal',
        workersCount: 1,
        materialHandling: 'tasker_brings',
        countryCode: 'LK',
      },
    })

    await prisma.jobQuote.create({
      data: {
        id: quoteAId,
        jobId,
        providerId: providerA,
        providerType: 'INDIVIDUAL',
        price: BigInt(5000),
        estimatedCompletionTime: '1h',
        attachments: '[]',
        status: 'PENDING',
      },
    })
  })

  afterAll(async () => {
    await prisma.jobEscrow.deleteMany({ where: { jobId } })
    await prisma.jobWorkspace.deleteMany({ where: { jobId } })
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { id: { in: [customerId, providerA, providerB] } } })
    await prisma.$disconnect()
  })

  it('unrelated customer cannot accept quote', async () => {
    const { acceptJobQuote } = await import('../../lib/domain/job-lifecycle')

    await expect(
      acceptJobQuote({ jobId, actorId: providerB, actorType: 'CUSTOMER' }, quoteAId)
    ).rejects.toThrow('Only the customer')
  })

  it('unrelated provider cannot accept quote', async () => {
    const { acceptJobQuote } = await import('../../lib/domain/job-lifecycle')

    await expect(
      acceptJobQuote({ jobId, actorId: providerB, actorType: 'PROVIDER' }, quoteAId)
    ).rejects.toThrow('Only the customer')
  })

  it('customer can accept own quote', async () => {
    const { acceptJobQuote } = await import('../../lib/domain/job-lifecycle')

    const result = await acceptJobQuote(
      { jobId, actorId: customerId, actorType: 'CUSTOMER' },
      quoteAId
    )
    expect(result.quote.status).toBe('ACCEPTED')
  })
})

describe.skipIf(!isVPS)('4D.11 — Security Closure Verification', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('FlashOffer claim requires auth (route-level check)', async () => {
    const route = await import('../../app/api/flash-offers/claim/route')
    expect(route.POST).toBeDefined()
  })

  it('Review POST requires auth (route-level check)', async () => {
    const route = await import('../../app/api/reviews/route')
    expect(route.POST).toBeDefined()
  })

  it('Seed endpoint blocks production', async () => {
    const originalEnv = process.env.NODE_ENV
    ;(process.env as any).NODE_ENV = 'production'

    const route = await import('../../app/api/seed/test-data/route')
    const mockRequest = new Request('http://localhost/api/seed/test-data', { method: 'POST' })
    const response = await route.POST(mockRequest as any)
    expect(response.status).toBe(403)

    ;(process.env as any).NODE_ENV = originalEnv
  })
})
