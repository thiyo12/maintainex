import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

import { findCandidates } from '@/lib/matching/index'
import { resolvePaymentMarketForIntent, createPaymentIntent } from '@/lib/finance/payments/payment-service'

/**
 * Phase 03 — LK/CA market isolation, executed against a real PostgreSQL database.
 *
 * These tests are DB-backed by design: market isolation is enforced through
 * Prisma `where` clauses and row locks, so a mocked database would prove
 * nothing. They live under tests/security/ so the blocking CI suite executes
 * them against the isolated test database rather than skipping.
 *
 * NO real payment gateway is contacted: every path under test rejects before any
 * network call, and the assertions assert the rejection code that proves which
 * gate fired.
 */

const prisma = new PrismaClient()

const VANCOUVER = { latitude: 49.2606, longitude: -123.1156 }   // inside the municipality
const BURNABY = { latitude: 49.2596, longitude: -122.998 }      // outside the municipality
const COLOMBO = { latitude: 6.9271, longitude: 79.8612 }        // Sri Lanka

describe('Phase 03 — LK/CA market isolation (PostgreSQL)', () => {
  let ts: number
  let categoryId: string
  let templateJobId: string
  let customerId: string
  let lkProviderId: string
  let caProviderId: string
  let companyId: string
  let workerUserId: string
  const created = { jobIds: [] as string[], userIds: [] as string[] }

  beforeAll(async () => {
    ts = Date.now()

    const category = await prisma.jobCategory.create({
      data: {
        name: `ISO Cat ${ts}`,
        slug: `iso-cat-${ts}`,
        iconName: 'wrench',
        colorHex: '#111111',
        countries: '["LK","CA"]',
        isActive: true,
        sortOrder: 0,
      },
    })
    categoryId = category.id

    const templateJob = await prisma.templateJob.create({
      data: {
        categoryId,
        name: `ISO Service ${ts}`,
        description: 'Isolation fixture service',
        whatIsIncluded: 'Test',
        typicalDurationMinutes: 60,
        priceMin: 1000,
        priceMax: 5000,
        currency: 'LKR',
        countries: '["LK","CA"]',
        isActive: true,
      },
    })
    templateJobId = templateJob.id

    const mkUser = async (countryCode: string, tag: string) => {
      const user = await prisma.user.create({
        data: {
          email: `iso-${tag}-${ts}@test.local`,
          passwordHash: 'x',
          name: `ISO ${tag} ${ts}`,
          phone: `+9477000${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
          countryCode,
          identityStatus: 'VERIFIED',
          isActive: true,
        },
      })
      created.userIds.push(user.id)
      return user
    }

    const customer = await mkUser('LK', 'customer')
    customerId = customer.id

    // Individual Sri Lankan provider with an LK capability.
    const lkUser = await mkUser('LK', 'lkprov')
    const lkProfile = await prisma.taskerProfile.create({
      data: {
        userId: lkUser.id,
        countryCode: 'LK',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        rating: 4.5,
        completedJobs: 10,
      },
    })
    lkProviderId = lkUser.id
    await prisma.taskerSkill.create({
      data: { taskerId: lkProfile.id, jobId: templateJobId, countryCode: 'LK', currency: 'LKR' },
    })

    // Individual Canadian provider with a CA capability.
    const caUser = await mkUser('CA', 'caprov')
    const caProfile = await prisma.taskerProfile.create({
      data: {
        userId: caUser.id,
        countryCode: 'CA',
        // A Vancouver provider must declare coverage: blank coverage is no
        // longer authority to serve the whole municipality.
        serviceAreas: '["Vancouver"]',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        rating: 4.5,
        completedJobs: 10,
      },
    })
    caProviderId = caUser.id
    await prisma.taskerSkill.create({
      data: { taskerId: caProfile.id, jobId: templateJobId, countryCode: 'CA', currency: 'CAD' },
    })

    // Company plus a worker member, both Sri Lankan.
    const companyOwner = await mkUser('LK', 'compowner')
    companyId = (await prisma.companyProfile.create({
      data: {
        userId: companyOwner.id,
        companyName: `ISO Co ${ts}`,
        services: '[]',
        serviceAreas: '[]',
        countryCode: 'LK',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        rating: 4.0,
        completedProjects: 5,
      },
    })).id

    const worker = await mkUser('LK', 'worker')
    workerUserId = worker.id
    await prisma.teamMember.create({
      data: {
        companyId,
        userId: worker.id,
        name: `ISO Worker ${ts}`,
        skills: '[]',
        role: 'WORKER',
        status: 'ACTIVE',
      },
    })
  })

  afterAll(async () => {
    try {
      for (const jobId of created.jobIds) {
        // These legacy fixtures do not have a workspace-on-delete cascade.
        await prisma.jobWorkspace.deleteMany({ where: { jobId } })
        await prisma.jobEscrow.deleteMany({ where: { jobId } })
        await prisma.jobQuote.deleteMany({ where: { jobId } })
        await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
      }
      await prisma.taskerSkill.deleteMany({ where: { jobId: templateJobId } })
      await prisma.teamMember.deleteMany({ where: { companyId } })
      await prisma.companyProfile.deleteMany({ where: { id: companyId } })
      await prisma.taskerProfile.deleteMany({
        where: { userId: { in: [lkProviderId, caProviderId] } },
      })
      await prisma.templateJob.deleteMany({ where: { id: templateJobId } })
      await prisma.jobCategory.deleteMany({ where: { id: categoryId } })
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } })
    } catch {
      // cleanup is best-effort
    }
    await prisma.$disconnect()
  })

  async function makeJob(data: {
    countryCode: string
    latitude?: number | null
    longitude?: number | null
    status?: string
  }) {
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: `ISO Job ${ts}`,
        description: 'Isolation job',
        categoryId,
        serviceTemplateId: null,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 5000n,
        status: data.status || 'OPEN',
        countryCode: data.countryCode,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    })
    created.jobIds.push(job.id)
    return job
  }

  it('a Vancouver job matches the Canadian provider and never the Sri Lankan one', async () => {
    const job = await makeJob({ countryCode: 'CA', ...VANCOUVER })

    const result = await findCandidates(prisma, {
      jobId: job.id,
      categoryId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
    })

    const ids = result.candidates.map(c => c.userId || c.providerId)
    expect(ids).toContain(caProviderId)
    expect(ids).not.toContain(lkProviderId)
  })

  it('a Colombo job matches the Sri Lankan provider and never the Canadian one', async () => {
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO })

    const result = await findCandidates(prisma, {
      jobId: job.id,
      categoryId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
    })

    const ids = result.candidates.map(c => c.userId || c.providerId)
    expect(ids).toContain(lkProviderId)
    expect(ids).not.toContain(caProviderId)
  })

  it('a Burnaby address stored as CA produces no candidates at all', async () => {
    // The coordinates are the authority; the stored CA flag must not widen it.
    const job = await makeJob({ countryCode: 'CA', ...BURNABY })

    const result = await findCandidates(prisma, {
      jobId: job.id,
      categoryId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
    })

    expect(result.candidates).toEqual([])
  })

  it('stored-country tampering cannot move a job across markets', async () => {
    // Coordinates say Vancouver; stored country says LK.
    const job = await makeJob({ countryCode: 'LK', ...VANCOUVER })

    const result = await findCandidates(prisma, {
      jobId: job.id,
      categoryId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
    })

    // Either the market is resolved from coordinates, or it is refused. What it
    // must never do is hand the job to the Sri Lankan provider.
    const ids = result.candidates.map(c => c.userId || c.providerId)
    expect(ids).not.toContain(lkProviderId)
  })

  it('a coordinate-less legacy Sri Lankan job still matches locally', async () => {
    const job = await makeJob({ countryCode: 'LK', latitude: null, longitude: null })

    const result = await findCandidates(prisma, {
      jobId: job.id,
      categoryId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
    })

    const ids = result.candidates.map(c => c.userId || c.providerId)
    expect(ids).toContain(lkProviderId)
  })

  it('a coordinate-less legacy Canadian job still matches locally', async () => {
    const job = await makeJob({ countryCode: 'CA', latitude: null, longitude: null })

    const result = await findCandidates(prisma, {
      jobId: job.id,
      categoryId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
    })

    const ids = result.candidates.map(c => c.userId || c.providerId)
    expect(ids).toContain(caProviderId)
  })

  it('a Vancouver provider with blank coverage does not match a Vancouver job', async () => {
    const undeclared = await prisma.user.create({
      data: {
        email: `iso-blankca-${Date.now()}@test.local`,
        passwordHash: 'x',
        name: 'ISO blankca',
        phone: `+9477000${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
        countryCode: 'CA',
        identityStatus: 'VERIFIED',
        isActive: true,
      },
    })
    const blankProfile = await prisma.taskerProfile.create({
      data: {
        userId: undeclared.id,
        countryCode: 'CA',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        rating: 4.0,
        completedJobs: 1,
      },
    })
    await prisma.taskerSkill.create({
      data: { taskerId: blankProfile.id, jobId: templateJobId, countryCode: 'CA', currency: 'CAD' },
    })
    try {
      const job = await makeJob({ countryCode: 'CA', ...VANCOUVER })
      const result = await findCandidates(prisma, {
        jobId: job.id, categoryId, jobMode: 'QUOTE', urgency: 'NORMAL',
      })
      const ids = result.candidates.map(c => c.userId || c.providerId)
      // Blank coverage must not authorise work across the whole municipality.
      expect(ids).not.toContain(undeclared.id)
      // The declared Vancouver provider still matches.
      expect(ids).toContain(caProviderId)
    } finally {
      await prisma.taskerSkill.deleteMany({ where: { taskerId: blankProfile.id } })
      await prisma.taskerProfile.deleteMany({ where: { id: blankProfile.id } })
      await prisma.user.deleteMany({ where: { id: undeclared.id } })
    }
  })

  it('a Vancouver provider inside a verified radius matches without a declared area', async () => {
    const near = await prisma.user.create({
      data: {
        email: `iso-radiusca-${Date.now()}@test.local`,
        passwordHash: 'x',
        name: 'ISO radiusca',
        phone: `+9477000${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
        countryCode: 'CA',
        identityStatus: 'VERIFIED',
        isActive: true,
      },
    })
    const radiusProfile = await prisma.taskerProfile.create({
      data: {
        userId: near.id,
        countryCode: 'CA',
        latitude: VANCOUVER.latitude,
        longitude: VANCOUVER.longitude,
        serviceRadius: 15,
        isVerified: true,
        verificationStatus: 'VERIFIED',
        rating: 4.0,
        completedJobs: 1,
      },
    })
    await prisma.taskerSkill.create({
      data: { taskerId: radiusProfile.id, jobId: templateJobId, countryCode: 'CA', currency: 'CAD' },
    })
    try {
      const job = await makeJob({ countryCode: 'CA', ...VANCOUVER })
      const result = await findCandidates(prisma, {
        jobId: job.id, categoryId, jobMode: 'QUOTE', urgency: 'NORMAL',
      })
      expect(result.candidates.map(c => c.userId || c.providerId)).toContain(near.id)
    } finally {
      await prisma.taskerSkill.deleteMany({ where: { taskerId: radiusProfile.id } })
      await prisma.taskerProfile.deleteMany({ where: { id: radiusProfile.id } })
      await prisma.user.deleteMany({ where: { id: near.id } })
    }
  })

  it('a Sri Lankan provider with blank coverage still matches, unchanged', async () => {
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO })
    const result = await findCandidates(prisma, {
      jobId: job.id, categoryId, jobMode: 'QUOTE', urgency: 'NORMAL',
    })
    // Historic Sri Lankan coverage semantics are preserved.
    expect(result.candidates.map(c => c.userId || c.providerId)).toContain(lkProviderId)
  })

  it('a company worker is not offered a Canadian job', async () => {
    const job = await makeJob({ countryCode: 'CA', ...VANCOUVER })

    const workerProfile = await prisma.taskerProfile.findFirst({
      where: { userId: workerUserId },
    })
    // The worker has no Canadian capability, so they must not appear.
    const result = await findCandidates(prisma, {
      jobId: job.id,
      categoryId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
    })
    const ids = result.candidates.map(c => c.userId || c.providerId)
    expect(ids).not.toContain(workerUserId)
    expect(workerProfile === null || true).toBe(true)
  })

  it('companyId and workerUserId are real fixtures, not undefined', () => {
    expect(companyId).toBeTruthy()
    expect(workerUserId).toBeTruthy()
  })
})

describe('Phase 03 — payment market isolation (PostgreSQL, no gateway calls)', () => {
  let ts: number
  let customerId: string
  let caProviderIdFallback: string
  const createdJobIds: string[] = []

  beforeAll(async () => {
    ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `iso-pay-${ts}@test.local`,
        passwordHash: 'x',
        name: `ISO Pay ${ts}`,
        phone: `+9477111${String(ts).slice(-5)}`,
        countryCode: 'LK',
        identityStatus: 'VERIFIED',
        isActive: true,
      },
    })
    customerId = user.id

    const provider = await prisma.user.create({
      data: {
        email: `iso-payprov-${ts}@test.local`,
        passwordHash: 'x',
        name: `ISO PayProv ${ts}`,
        phone: `+9477222${String(ts).slice(-5)}`,
        countryCode: 'CA',
        identityStatus: 'VERIFIED',
        isActive: true,
      },
    })
    caProviderIdFallback = provider.id
  })

  afterAll(async () => {
    try {
      await prisma.jobEscrow.deleteMany({ where: { customerId } })
      await prisma.jobWorkspace.deleteMany({ where: { jobId: { in: createdJobIds } } })
      await prisma.jobQuote.deleteMany({ where: { jobId: { in: createdJobIds } } })
      await prisma.marketplaceJob.deleteMany({ where: { customerId } })
      await prisma.jobCategory.deleteMany({ where: { slug: { startsWith: 'iso-paycat' } } })
      await prisma.user.deleteMany({ where: { id: { in: [customerId, caProviderIdFallback] } } })
    } catch { /* best effort */ }
    await prisma.$disconnect()
  })

  it('a stored CA job with Burnaby coordinates is refused before provider resolution', async () => {
    const market = resolvePaymentMarketForIntent({
      countryCode: 'CA',
      latitude: BURNABY.latitude,
      longitude: BURNABY.longitude,
    })
    expect(market.ok).toBe(false)
    if (!market.ok) expect(market.code).toBe('JOB_MARKET_UNRESOLVED')
  })

  it('a stored LK job with Vancouver coordinates is refused as a mismatch', async () => {
    const market = resolvePaymentMarketForIntent({
      countryCode: 'LK',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
    })
    expect(market.ok).toBe(false)
    if (!market.ok) expect(market.code).toBe('PAYMENT_MARKET_MISMATCH')
  })

  it('createPaymentIntent refuses a mismatched market before touching a gateway', async () => {
    const category = await prisma.jobCategory.create({
      data: {
        name: `ISO PayCat ${ts}`,
        slug: `iso-paycat-${ts}`,
        iconName: 'wrench',
        colorHex: '#222222',
        countries: '["LK","CA"]',
        isActive: true,
        sortOrder: 0,
      },
    })
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'ISO Pay Job',
        description: 'payment isolation',
        categoryId: category.id,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 5000n,
        status: 'QUOTE_ACCEPTED',
        countryCode: 'CA',
        latitude: BURNABY.latitude,
        longitude: BURNABY.longitude,
      },
    })
    createdJobIds.push(job.id)
    await prisma.jobEscrow.create({
      data: {
        jobId: job.id,
        quoteId: `iso-quote-${ts}-a`,
        customerId,
        providerId: caProviderIdFallback,
        currency: 'CAD',
        amount: 5000n,
        totalAmount: 5500n,
        serviceFee: 500n,
        status: 'PENDING',
        paymentMethod: 'CARD',
      },
    })

    const result = await createPaymentIntent({
      jobId: job.id,
      customerId,
      baseUrl: 'https://example.invalid',
    })

    // The market gate fires first. A provider-resolution or gateway error would
    // mean the market guard did not run before payment creation.
    expect(result.success).toBe(false)
    expect(['JOB_MARKET_UNRESOLVED', 'PAYMENT_MARKET_MISMATCH']).toContain(result.code)

    try {
      await prisma.jobEscrow.deleteMany({ where: { jobId: job.id } })
      // Keep database integrity even if payment intent code creates a
      // workspace on a previously rejected job.
      await prisma.jobWorkspace.deleteMany({ where: { jobId: job.id } })
      await prisma.jobQuote.deleteMany({ where: { jobId: job.id } })
      await prisma.marketplaceJob.deleteMany({ where: { id: job.id } })
      await prisma.jobCategory.deleteMany({ where: { id: category.id } })
    } catch { /* best effort */ }
  })

  it('repeated payment-intent creation for a mismatched market stays refused', async () => {
    const repeatCategory = await prisma.jobCategory.create({
      data: {
        name: `ISO RepeatCat ${ts}`,
        slug: `iso-repeatcat-${ts}`,
        iconName: 'wrench',
        colorHex: '#333333',
        countries: '["LK","CA"]',
        isActive: true,
        sortOrder: 0,
      },
    })
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'ISO Pay Repeat',
        description: 'repeat isolation',
        categoryId: repeatCategory.id,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 5000n,
        status: 'QUOTE_ACCEPTED',
        countryCode: 'LK',
        latitude: VANCOUVER.latitude,
        longitude: VANCOUVER.longitude,
      },
    })
    createdJobIds.push(job.id)
    await prisma.jobEscrow.create({
      data: {
        jobId: job.id,
        quoteId: `iso-quote-${ts}-b`,
        customerId,
        providerId: caProviderIdFallback,
        currency: 'LKR',
        amount: 5000n,
        totalAmount: 5500n,
        serviceFee: 500n,
        status: 'PENDING',
        paymentMethod: 'CARD',
      },
    })

    const outcomes = new Set<string>()
    for (let i = 0; i < 3; i += 1) {
      const r = await createPaymentIntent({ jobId: job.id, customerId, baseUrl: 'https://example.invalid' })
      outcomes.add(r.success ? 'created' : String(r.code))
    }
    expect(outcomes.size).toBe(1)
    expect([...outcomes][0]).toBe('PAYMENT_MARKET_MISMATCH')

    try {
      await prisma.jobEscrow.deleteMany({ where: { jobId: job.id } })
      // Keep database integrity even if payment intent code creates a
      // workspace on a previously rejected job.
      await prisma.jobWorkspace.deleteMany({ where: { jobId: job.id } })
      await prisma.jobQuote.deleteMany({ where: { jobId: job.id } })
      await prisma.marketplaceJob.deleteMany({ where: { id: job.id } })
      await prisma.jobCategory.deleteMany({ where: { id: repeatCategory.id } })
    } catch { /* best effort */ }
  })
})
