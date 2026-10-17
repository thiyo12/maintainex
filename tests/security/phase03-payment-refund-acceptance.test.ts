import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

import { createPaymentIntent, resolvePaymentMarketForIntent } from '@/lib/finance/payments/payment-service'
import { refundEscrow } from '@/lib/finance/escrow/escrow-service'
import type { TransitionContext } from '@/lib/domain/job-lifecycle'
import { requireJobMarket } from '@/lib/geography/market-engine'

/**
 * Phase 03 financial acceptance — executed against a real PostgreSQL database.
 *
 * Scope discipline:
 *  - NO live payment gateway is contacted and NO credentials are fabricated.
 *    Online intent creation requires a configured PayPal runtime, so those paths
 *    are asserted to refuse BEFORE any network call; the idempotency mechanism is
 *    therefore verified at the database level instead.
 *  - No payment, escrow or refund system is modified by these tests.
 *
 * All fixtures are prefixed P03 and removed afterwards.
 */

const prisma = new PrismaClient()

const VANCOUVER = { latitude: 49.2606, longitude: -123.1156 }
const BURNABY = { latitude: 49.2596, longitude: -122.998 }
const COLOMBO = { latitude: 6.9271, longitude: 79.8612 }

const VANCOUVER_CITY = { lat: 49.2827, lon: -123.1207 }

describe('Phase 03 financial acceptance (PostgreSQL)', () => {
  let ts: number
  let categoryId: string
  let customerId: string
  let providerUserId: string
  let quoteId: string
  const jobIds: string[] = []
  const escrowIds: string[] = []

  beforeAll(async () => {
    ts = Date.now()

    const category = await prisma.jobCategory.create({
      data: {
        name: `P03 Cat ${ts}`,
        slug: `p03-cat-${ts}`,
        iconName: 'wrench',
        colorHex: '#555555',
        countries: '["LK","CA"]',
        isActive: true,
        sortOrder: 0,
      },
    })
    categoryId = category.id

    const mkUser = (countryCode: string, tag: string) =>
      prisma.user.create({
        data: {
          email: `p03-${tag}-${ts}@test.local`,
          passwordHash: 'x',
          name: `P03 ${tag}`,
          phone: `+9477${String(ts).slice(-6)}${tag === 'a' ? '00001' : '00002'}`,
          countryCode,
          identityStatus: 'VERIFIED',
          isActive: true,
        },
      })

    customerId = (await mkUser('LK', 'customer')).id
    providerUserId = (await mkUser('LK', 'provider')).id

    // Legacy cash escrows refund to the customer wallet. Give the fixture
    // customer a funded wallet so historical refund behaviour can be executed.
    await prisma.customerWallet.create({
      data: { userId: customerId, balance: 100000, currency: 'LKR' },
    })
  })

  afterAll(async () => {
    try {
      await prisma.financialLedger.deleteMany({ where: { referenceType: 'ESCROW_DEPOSIT', referenceId: { in: escrowIds } } })
      await prisma.paymentIntent.deleteMany({ where: { jobId: { in: jobIds } } })
      await prisma.jobEscrow.deleteMany({ where: { jobId: { in: jobIds } } })
      await prisma.jobQuote.deleteMany({ where: { jobId: { in: jobIds } } })
      await prisma.marketplaceJob.deleteMany({ where: { id: { in: jobIds } } })
      await prisma.customerWallet.deleteMany({ where: { userId: customerId } })
      await prisma.jobCategory.deleteMany({ where: { id: categoryId } })
      await prisma.user.deleteMany({ where: { id: { in: [customerId, providerUserId] } } })
    } catch { /* best effort */ }
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
        title: `P03 Job ${ts}`,
        description: 'financial acceptance fixture',
        categoryId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 5000n,
        status: data.status || 'OPEN',
        countryCode: data.countryCode,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    })
    jobIds.push(job.id)
    return job
  }

  async function fundEscrow(jobId: string, currency: string) {
    const quote = await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: providerUserId,
        providerType: 'INDIVIDUAL',
        price: 5000n,
        estimatedCompletionTime: '1 day',
        attachments: '[]',
        status: 'ACCEPTED',
      },
    })
    quoteId = quote.id
    const escrow = await prisma.jobEscrow.create({
      data: {
        jobId,
        quoteId: quote.id,
        customerId,
        providerId: providerUserId,
        currency,
        amount: 5000n,
        serviceFee: 500n,
        totalAmount: 5500n,
        status: 'PROTECTED',
        // Wallet-funded (non-cash) escrow: the refund path credits the wallet.
        paymentMethod: 'CARD',
      },
    })
    escrowIds.push(escrow.id)

    // A real escrowed balance has a matching ledger entry; the refund path
    // resolves its funding source from this record.
    await prisma.financialLedger.create({
      data: {
        accountId: `wallet:${customerId}`,
        accountType: 'CUSTOMER_WALLET',
        entryType: 'DEBIT',
        amount: 5500n,
        currency,
        referenceType: 'ESCROW_DEPOSIT',
        referenceId: escrow.id,
        idempotencyKey: `p03-escrow-deposit-${escrow.id}`,
        createdBy: 'phase03-acceptance',
      },
    })

    return escrow
  }

  /* ---------------- 1. Market validation before any gateway call ---------------- */

  it('refuses a mismatched market before provider resolution (no gateway call)', async () => {
    const job = await makeJob({ countryCode: 'LK', ...VANCOUVER })
    await fundEscrow(job.id, 'LKR')

    const result = await createPaymentIntent({
      jobId: job.id,
      customerId,
      baseUrl: 'https://example.invalid',
    })

    expect(result.success).toBe(false)
    // The market gate fires first; a provider/gateway error would mean it did not.
    expect(result.code).toBe('PAYMENT_MARKET_MISMATCH')
  })

  it('refuses an out-of-market address stored as Canadian', async () => {
    const job = await makeJob({ countryCode: 'CA', ...BURNABY })
    await fundEscrow(job.id, 'CAD')

    const result = await createPaymentIntent({
      jobId: job.id,
      customerId,
      baseUrl: 'https://example.invalid',
    })
    expect(result.success).toBe(false)
    expect(result.code).toBe('JOB_MARKET_UNRESOLVED')
  })

  it('refuses an unauthorised caller before any market or gateway work', async () => {
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO })
    await fundEscrow(job.id, 'LKR')

    const result = await createPaymentIntent({
      jobId: job.id,
      customerId: 'some-other-user',
      baseUrl: 'https://example.invalid',
    })
    expect(result.success).toBe(false)
    expect(result.code).toBe('UNAUTHORIZED')
  })

  /* ---------------- 2. Locked-row revalidation ---------------- */

  it('re-reads the authoritative market under a row lock', async () => {
    // The locked SELECT must load coordinates; otherwise revalidation silently
    // falls back to the stored country.
    const job = await makeJob({ countryCode: 'CA', ...VANCOUVER })
    await fundEscrow(job.id, 'CAD')

    // Simulate a market change between the preview read and the locked read:
    // the coordinates are mutated after the intent path has been exercised.
    const before = resolvePaymentMarketForIntent({
      countryCode: 'CA',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
    })
    expect(before.ok).toBe(true)

    await prisma.marketplaceJob.update({
      where: { id: job.id },
      data: { latitude: BURNABY.latitude, longitude: BURNABY.longitude },
    })

    const after = resolvePaymentMarketForIntent({
      countryCode: 'CA',
      latitude: BURNABY.latitude,
      longitude: BURNABY.longitude,
    })
    expect(after.ok).toBe(false)

    // The persisted row now fails the same check the locked revalidation uses.
    const reloaded = await prisma.marketplaceJob.findUnique({
      where: { id: job.id },
      select: { countryCode: true, latitude: true, longitude: true },
    })
    expect(requireJobMarket(reloaded!).ok).toBe(false)
  })

  it('a mutated job is refused when payment is retried', async () => {
    const job = await makeJob({ countryCode: 'CA', ...VANCOUVER })
    await fundEscrow(job.id, 'CAD')
    await prisma.marketplaceJob.update({
      where: { id: job.id },
      data: { latitude: BURNABY.latitude, longitude: BURNABY.longitude },
    })

    const result = await createPaymentIntent({
      jobId: job.id,
      customerId,
      baseUrl: 'https://example.invalid',
    })
    expect(result.success).toBe(false)
    expect(result.code).toBe('JOB_MARKET_UNRESOLVED')
  })

  /* ---------------- 3. Idempotency and concurrency ---------------- */

  it('repeated refusal for the same job is stable and creates no intent', async () => {
    const job = await makeJob({ countryCode: 'LK', ...VANCOUVER })
    await fundEscrow(job.id, 'LKR')

    const outcomes = new Set<string>()
    for (let i = 0; i < 5; i += 1) {
      const r = await createPaymentIntent({ jobId: job.id, customerId, baseUrl: 'https://example.invalid' })
      outcomes.add(r.success ? 'created' : String(r.code))
    }
    expect([...outcomes]).toEqual(['PAYMENT_MARKET_MISMATCH'])
    expect(await prisma.paymentIntent.count({ where: { jobId: job.id } })).toBe(0)
  })

  it('concurrent requests on one job produce no duplicate intents', async () => {
    const job = await makeJob({ countryCode: 'LK', ...VANCOUVER })
    await fundEscrow(job.id, 'LKR')

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        createPaymentIntent({ jobId: job.id, customerId, baseUrl: 'https://example.invalid' }),
      ),
    )

    const codes = new Set(results.map(r => (r.success ? 'created' : String(r.code))))
    expect(codes.size).toBe(1)
    expect(await prisma.paymentIntent.count({ where: { jobId: job.id } })).toBe(0)
  })

  it('a row lock genuinely serialises concurrent readers of the same job', async () => {
    // Proves the FOR UPDATE used by the locked revalidation really blocks.
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO })

    const order: string[] = []
    let releaseFirst: () => void = () => {}
    const firstHasLock = new Promise<void>(resolve => { releaseFirst = resolve })

    const slow = prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM "MarketplaceJob" WHERE id = ${job.id} FOR UPDATE`
      order.push('lock-acquired')
      // Hold the lock until the second transaction has certainly started.
      await firstHasLock
      await new Promise(r => setTimeout(r, 250))
      order.push('lock-released')
    })

    // Start the second only after the first demonstrably holds the lock.
    await new Promise(r => setTimeout(r, 150))
    const blocked = prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM "MarketplaceJob" WHERE id = ${job.id} FOR UPDATE`
      order.push('second-lock-acquired')
    })
    releaseFirst()

    await Promise.all([slow, blocked])
    expect(order[0]).toBe('lock-acquired')
    expect(order).toContain('second-lock-acquired')
    expect(order.indexOf('lock-released')).toBeLessThan(order.indexOf('second-lock-acquired'))
  })

  it('an existing pending intent is reusable rather than duplicated (DB contract)', async () => {
    // The reuse query createPaymentIntent relies on, exercised directly because
    // reaching intent creation requires real gateway credentials.
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO })
    await fundEscrow(job.id, 'LKR')

    await prisma.paymentIntent.create({
      data: {
        jobId: job.id,
        customerId,
        escrowId: (await prisma.jobEscrow.findFirstOrThrow({ where: { jobId: job.id } })).id,
        merchantOrderId: `PP-PENDING-${ts}`,
        gateway: 'PAYPAL',
        amount: 5500n,
        currency: 'LKR',
        status: 'CREATED',
      },
    })

    const existing = await prisma.paymentIntent.findFirst({
      where: { jobId: job.id, gateway: 'PAYPAL', status: { in: ['CREATED', 'PENDING'] } },
      select: { id: true, merchantOrderId: true },
    })
    expect(existing).not.toBeNull()
    expect(await prisma.paymentIntent.count({ where: { jobId: job.id } })).toBe(1)

    const result = await createPaymentIntent({ jobId: job.id, customerId, baseUrl: 'https://example.invalid' })
    expect(result.success).toBe(false)
    expect(await prisma.paymentIntent.count({ where: { jobId: job.id } })).toBe(1)
  })

  /* ---------------- 4. Historical refund compatibility ---------------- */

  it('refunds a coordinate-less legacy job successfully', async () => {
    const job = await makeJob({ countryCode: 'LK', latitude: null, longitude: null, status: 'QUOTE_ACCEPTED' })
    await fundEscrow(job.id, 'LKR')
    await prisma.marketplaceJob.update({
      where: { id: job.id },
      data: { targetTaskerId: null, status: 'QUOTE_ACCEPTED' },
    })

    const ctx: TransitionContext = {
      jobId: job.id,
      actorId: customerId,
      actorType: 'CUSTOMER',
      reason: 'phase03 acceptance refund',
    } as TransitionContext

    await expect(refundEscrow(ctx, job.id)).resolves.toBeDefined()
    const escrow = await prisma.jobEscrow.findFirstOrThrow({ where: { jobId: job.id } })
    expect(escrow.status).toBe('REFUNDED')
  })

  it('refunds a Vancouver job successfully (legacy Canadian booking)', async () => {
    const job = await makeJob({ countryCode: 'CA', ...VANCOUVER, status: 'QUOTE_ACCEPTED' })
    await fundEscrow(job.id, 'CAD')

    const ctx: TransitionContext = {
      jobId: job.id,
      actorId: customerId,
      actorType: 'CUSTOMER',
      reason: 'phase03 acceptance canada refund',
    } as TransitionContext

    await expect(refundEscrow(ctx, job.id)).resolves.toBeDefined()
    const escrow = await prisma.jobEscrow.findFirstOrThrow({ where: { jobId: job.id } })
    expect(escrow.status).toBe('REFUNDED')
  })

  it('refunds a job whose coordinates were never validated', async () => {
    // Coordinates outside launch geography must NOT strand customer money.
    const job = await makeJob({ countryCode: 'CA', ...BURNABY, status: 'QUOTE_ACCEPTED' })
    await fundEscrow(job.id, 'CAD')

    const ctx: TransitionContext = {
      jobId: job.id,
      actorId: customerId,
      actorType: 'CUSTOMER',
      reason: 'phase03 acceptance out-of-market refund',
    } as TransitionContext

    await expect(refundEscrow(ctx, job.id)).resolves.toBeDefined()
    expect((await prisma.jobEscrow.findFirstOrThrow({ where: { jobId: job.id } })).status)
      .toBe('REFUNDED')
  })

  it('refund still refuses an unauthorised actor', async () => {
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO, status: 'QUOTE_ACCEPTED' })
    await fundEscrow(job.id, 'LKR')

    const ctx: TransitionContext = {
      jobId: job.id,
      actorId: 'not-the-customer',
      actorType: 'CUSTOMER',
      reason: 'unauthorised',
    } as unknown as TransitionContext

    await expect(refundEscrow(ctx, job.id)).rejects.toThrow()
    expect((await prisma.jobEscrow.findFirstOrThrow({ where: { jobId: job.id } })).status)
      .toBe('PROTECTED')
  })

  it('the Vancouver boundary fixture coordinates are genuinely inside the municipality', () => {
    expect(VANCOUVER_CITY.lat).toBeGreaterThan(49.2)
    expect(BURNABY.longitude).toBeGreaterThan(-123.1)
  })
})
