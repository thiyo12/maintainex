/**
 * Phase 03: cash-payment market enforcement on the real route.
 *
 * Before the fix, `confirmCashPayment` gated cash on the job's STORED country
 * with an implicit `|| 'LK'` fallback, in two places: the pre-lock market check
 * and `assertProviderCashEligible` inside the transaction. A job stored `LK`
 * with Vancouver coordinates therefore passed both gates even though the payment
 * intent route refused the same job.
 *
 * The fix revalidates from the LOCKED job row using the same authoritative
 * resolver as payment-intent creation. These tests exercise the real route with
 * authentication mocked; no payment gateway is involved.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const COLOMBO = { latitude: 6.9271, longitude: 79.8612 }
const VANCOUVER = { latitude: 49.2606, longitude: -123.1156 }
const BURNABY = { latitude: 49.2599, longitude: -122.9011 }

const mockUser = { current: null as null | { id: string } }

vi.mock('@/lib/auth/compatibility/mobile-auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    authenticateRequest: async () => mockUser.current,
    assertNotSuspended: () => null,
  }
})

vi.mock('@/lib/finance/payments/provider-registry', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    isCashPaymentAvailableForMarket: (countryCode: string | null, currency: string) => {
      if (currency === 'CAD') return countryCode === 'CA'
      return countryCode === 'LK'
    },
  }
})

async function callRoute(jobId: string) {
  const { POST } = await import(
    '../../app/api/mobile/v2/jobs/[id]/cash-payment/route'
  )
  const req = new Request(`http://localhost/api/mobile/v2/jobs/${jobId}/cash-payment`, {
    method: 'POST',
  }) as unknown as import('next/server').NextRequest
  const res = await POST(req, { params: Promise.resolve({ id: jobId }) })
  let body: any = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

describe('Phase 03 — cash payment market enforcement (PostgreSQL)', () => {
  let ts = 0
  let prisma: any
  let categoryId = ''
  let customerId = ''
  let otherUserId = ''
  let providerUserId = ''
  let caProviderUserId = ''
  let createdJobIds: string[] = []
  let paymentProviderConfigIds: string[] = []

  beforeAll(async () => {
    const mod = await import('../../lib/prisma')
    prisma = mod.prisma
    ts = Date.now()

    const category = await prisma.jobCategory.create({
      data: {
        name: `P03CASH Cat ${ts}`,
        slug: `p03cash-cat-${ts}`,
        iconName: 'wrench',
        colorHex: '#666666',
        countries: '["LK","CA"]',
        isActive: true,
        sortOrder: 0,
      } as never,
    })
    categoryId = (category as any).id

    const mk = (countryCode: string, tag: string) =>
      prisma.user.create({
        data: {
          email: `p03cash-${tag}-${ts}@test.local`,
          passwordHash: 'x',
          name: `P03CASH ${tag}`,
          phone: `+9477${String(ts).slice(-6)}${tag === 'customer' ? '00001' : '00002'}`,
          countryCode,
          identityStatus: 'VERIFIED',
          isActive: true,
        } as never,
      })

    customerId = (await mk('LK', 'customer')).id
    otherUserId = (await mk('LK', 'other')).id
    providerUserId = (await mk('LK', 'provider')).id
    caProviderUserId = (await mk('CA', 'caprovider')).id

    for (const [userId, country] of [
      [providerUserId, 'LK'],
      [caProviderUserId, 'CA'],
    ] as const) {
      await prisma.taskerProfile.create({
        data: {
          userId,
          countryCode: country,
          isVerified: true,
          verificationStatus: 'VERIFIED',
          rating: 4.5,
          completedJobs: 5,
        } as never,
      })
    }
  })

  afterAll(async () => {
    await prisma.jobEscrow.deleteMany({ where: { jobId: { in: createdJobIds } } })
    await prisma.jobQuote.deleteMany({ where: { jobId: { in: createdJobIds } } })
    await prisma.marketplaceJob.deleteMany({ where: { id: { in: createdJobIds } } })
    await prisma.paymentProviderConfig.deleteMany({
      where: { id: { in: paymentProviderConfigIds } },
    })
    // Cash confirmation creates provider financial rows; drop the dependents
    // before the identity rows they reference.
    await prisma.providerFinancialAccount.deleteMany({
      where: { providerIdentity: { currentUserId: { in: [providerUserId, caProviderUserId] } } },
    })
    await prisma.taskerProfile.deleteMany({
      where: { userId: { in: [providerUserId, caProviderUserId] } },
    })
    await prisma.providerIdentity.deleteMany({
      where: { currentUserId: { in: [providerUserId, caProviderUserId] } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [customerId, otherUserId, providerUserId, caProviderUserId] } },
    })
    await prisma.jobCategory.deleteMany({ where: { id: categoryId } })
  })

  /**
   * Builds a genuinely payable pending escrow: accepted quote, matching
   * authorized amount, PENDING_PAYMENT status. A settled-job rejection would
   * NOT prove the market gate works, so these always stay payable.
   */
  async function makePayableJob(opts: {
    countryCode: string
    latitude?: number | null
    longitude?: number | null
    currency?: string
    providerUser?: string
    escrowStatus?: string
    paymentMethod?: string
  }) {
    const currency = opts.currency || (opts.countryCode === 'CA' ? 'CAD' : 'LKR')
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: `P03CASH Job ${ts}-${createdJobIds.length}`,
        description: 'cash payment market acceptance',
        categoryId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 5000n,
        countryCode: opts.countryCode,
        latitude: opts.latitude ?? null,
        longitude: opts.longitude ?? null,
        status: 'QUOTE_ACCEPTED',
      } as never,
    })
    createdJobIds.push(job.id)

    const quote = await prisma.jobQuote.create({
      data: {
        jobId: job.id,
        providerId: opts.providerUser || providerUserId,
        providerType: 'INDIVIDUAL',
        price: 5000n,
        estimatedCompletionTime: '1 day',
        attachments: '[]',
        status: 'ACCEPTED',
        currency,
      } as never,
    })

    await prisma.jobEscrow.create({
      data: {
        jobId: job.id,
        quoteId: (quote as any).id,
        customerId,
        providerId: opts.providerUser || providerUserId,
        currency,
        amount: 5000n,
        serviceFee: 500n,
        totalAmount: 5500n,
        status: opts.escrowStatus || 'PENDING_PAYMENT',
        paymentMethod: opts.paymentMethod || 'CARD',
      } as never,
    })

    return job
  }

  it('refuses cash for a pending job stored LK with Vancouver coordinates', async () => {
    const job = await makePayableJob({
      countryCode: 'LK',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
    })
    mockUser.current = { id: customerId }
    const res = await callRoute(job.id)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CASH_PAYMENT_NOT_AVAILABLE_FOR_MARKET')
  })

  it('refuses cash for a pending job stored CA outside the Vancouver municipality', async () => {
    const job = await makePayableJob({
      countryCode: 'CA',
      latitude: BURNABY.latitude,
      longitude: BURNABY.longitude,
      providerUser: caProviderUserId,
    })
    mockUser.current = { id: customerId }
    const res = await callRoute(job.id)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CASH_PAYMENT_NOT_AVAILABLE_FOR_MARKET')
  })

  it('refuses cash when the market is unresolved and never defaults to LK', async () => {
    const job = await makePayableJob({
      countryCode: 'LK',
      latitude: null,
      longitude: null,
    })
    // Force a stored country that is not a launch market, with no coordinates.
    await prisma.marketplaceJob.update({
      where: { id: job.id },
      data: { countryCode: 'ZZ' },
    })
    mockUser.current = { id: customerId }
    const res = await callRoute(job.id)
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CASH_PAYMENT_NOT_AVAILABLE_FOR_MARKET')
  })

  it('keeps a legitimate LK/LKR cash selection working', async () => {
    const job = await makePayableJob({
      countryCode: 'LK',
      latitude: COLOMBO.latitude,
      longitude: COLOMBO.longitude,
    })
    mockUser.current = { id: customerId }
    const res = await callRoute(job.id)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CASH_CONFIRMED')

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    expect(escrow?.status).toBe('CASH_CONFIRMED')
  })

  it('allows a legitimate Vancouver/CAD cash selection', async () => {
    const job = await makePayableJob({
      countryCode: 'CA',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
      currency: 'CAD',
      providerUser: caProviderUserId,
    })
    mockUser.current = { id: customerId }
    const res = await callRoute(job.id)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CASH_CONFIRMED')
  })

  it('refuses a non-owner', async () => {
    const job = await makePayableJob({
      countryCode: 'LK',
      latitude: COLOMBO.latitude,
      longitude: COLOMBO.longitude,
    })
    mockUser.current = { id: otherUserId }
    const res = await callRoute(job.id)
    expect(res.status).toBe(403)
  })

  it('refuses a mismatched authorized amount', async () => {
    const job = await makePayableJob({
      countryCode: 'LK',
      latitude: COLOMBO.latitude,
      longitude: COLOMBO.longitude,
    })
    await prisma.jobEscrow.updateMany({
      where: { jobId: job.id },
      data: { amount: 9999n },
    })
    mockUser.current = { id: customerId }
    const res = await callRoute(job.id)
    expect(res.status).toBe(409)
    expect(res.body.error).toContain('ESCROW_AUTHORIZED_AMOUNT_MISMATCH')
  })

  it('refuses when the market changes between preview and the locked transaction', async () => {
    const job = await makePayableJob({
      countryCode: 'LK',
      latitude: COLOMBO.latitude,
      longitude: COLOMBO.longitude,
    })
    mockUser.current = { id: customerId }

    // Mutate the row while the route is between its preview read and its
    // FOR UPDATE: the locked row is the only authority, so this must be refused.
    const originalUpdate = prisma.$transaction
    let mutated = false
    ;(prisma as any).$transaction = async (arg: any) => {
      if (!mutated) {
        mutated = true
        await prisma.marketplaceJob.update({
          where: { id: job.id },
          data: { latitude: VANCOUVER.latitude, longitude: VANCOUVER.longitude },
        })
      }
      return originalUpdate.call(prisma, arg)
    }
    try {
      const res = await callRoute(job.id)
      expect(res.status).toBe(409)
      expect(res.body.code).toBe('CASH_PAYMENT_NOT_AVAILABLE_FOR_MARKET')
    } finally {
      ;(prisma as any).$transaction = originalUpdate
    }

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    expect(escrow?.status).toBe('PENDING_PAYMENT')
  })

  it('preserves idempotent read of an already-confirmed historical cash selection', async () => {
    const job = await makePayableJob({
      countryCode: 'LK',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
      escrowStatus: 'CASH_CONFIRMED',
      paymentMethod: 'CASH',
    })
    mockUser.current = { id: customerId }
    const res = await callRoute(job.id)
    // Historical cash must stay accessible even when the metadata is now
    // inconsistent, and must not start a second transaction.
    expect(res.status).toBe(200)
    expect(res.body.alreadyConfirmed).toBe(true)

    const escrows = await prisma.jobEscrow.count({ where: { jobId: job.id } })
    expect(escrows).toBe(1)
  })

  it('leaves refunds and historic escrow records untouched by a refusal', async () => {
    const job = await makePayableJob({
      countryCode: 'LK',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
    })
    mockUser.current = { id: customerId }
    const res = await callRoute(job.id)
    expect(res.status).toBe(409)

    const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: job.id } })
    expect(escrow?.status).toBe('PENDING_PAYMENT')
    expect(escrow?.paymentMethod).toBe('CARD')

    const intents = await prisma.paymentIntent.count({ where: { jobId: job.id } })
    expect(intents).toBe(0)
  })
})
