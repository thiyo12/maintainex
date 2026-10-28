import { describe, expect, it, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'

/**
 * Phase 03 — route-level payment GET behaviour.
 *
 * Exercises the real Next.js route handler against a real PostgreSQL database
 * with ONLY authentication mocked. No payment gateway is contacted and no
 * credentials are created: provider resolution returns null because no enabled
 * provider configuration exists, which is the production posture today.
 *
 * The central assertion is parity: GET must not advertise payment options that
 * POST would refuse.
 */

const prisma = new PrismaClient()

const mockUser = { current: null as any }

vi.mock('@/lib/auth/compatibility/mobile-auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    authenticateRequest: async () => mockUser.current,
    assertNotSuspended: () => null,
  }
})

const VANCOUVER = { latitude: 49.2606, longitude: -123.1156 }
const BURNABY = { latitude: 49.2596, longitude: -122.998 }
const COLOMBO = { latitude: 6.9271, longitude: 79.8612 }

async function callGet(jobId: string) {
  const { GET } = await import('@/app/api/mobile/v2/jobs/[id]/payment/route')
  const { NextRequest } = await import('next/server')
  const request = new NextRequest(`https://example.invalid/api/mobile/v2/jobs/${jobId}/payment`)
  const response = await GET(request as never, { params: Promise.resolve({ id: jobId }) })
  let body: any = null
  try { body = await response.json() } catch { body = null }
  return { status: response.status, body }
}

async function callPost(jobId: string) {
  const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/payment/route')
  const { NextRequest } = await import('next/server')
  const request = new NextRequest(`https://example.invalid/api/mobile/v2/jobs/${jobId}/payment`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  const response = await POST(request as never, { params: Promise.resolve({ id: jobId }) })
  let body: any = null
  try { body = await response.json() } catch { body = null }
  return { status: response.status, body }
}

describe('Phase 03 — payment GET route behaviour (PostgreSQL, auth mocked)', () => {
  let ts: number
  let categoryId: string
  let customerId: string
  let otherUserId: string
  let providerUserId: string
  const jobIds: string[] = []
  const escrowIds: string[] = []

  beforeAll(async () => {
    ts = Date.now()
    const category = await prisma.jobCategory.create({
      data: {
        name: `P03GET Cat ${ts}`,
        slug: `p03get-cat-${ts}`,
        iconName: 'wrench',
        colorHex: '#666666',
        countries: '["LK","CA"]',
        isActive: true,
        sortOrder: 0,
      },
    })
    categoryId = category.id

    const mkUser = (countryCode: string, tag: string) =>
      prisma.user.create({
        data: {
          email: `p03get-${tag}-${ts}@test.local`,
          passwordHash: 'x',
          name: `P03GET ${tag}`,
          phone: `+9477${String(ts).slice(-6)}${tag === 'a' ? '00001' : '00002'}`,
          countryCode,
          identityStatus: 'VERIFIED',
          isActive: true,
        },
      })

    const customer = await mkUser('LK', 'customer')
    customerId = customer.id
    otherUserId = (await mkUser('LK', 'other')).id
    providerUserId = (await mkUser('LK', 'provider')).id

    // The accepted quote's provider needs a real tasker profile; the commission
    // standing lookup resolves provider identity from it.
    await prisma.taskerProfile.create({
      data: {
        userId: providerUserId,
        countryCode: 'LK',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        rating: 4.5,
        completedJobs: 5,
      },
    })
  })

  afterAll(async () => {
    try {
      await prisma.paymentIntent.deleteMany({ where: { jobId: { in: jobIds } } })
      await prisma.jobEscrow.deleteMany({ where: { jobId: { in: jobIds } } })
      await prisma.jobQuote.deleteMany({ where: { jobId: { in: jobIds } } })
      await prisma.marketplaceJob.deleteMany({ where: { id: { in: jobIds } } })
      await prisma.taskerProfile.deleteMany({ where: { userId: providerUserId } })
      await prisma.providerIdentity.deleteMany({ where: { currentUserId: providerUserId } })
      await prisma.jobCategory.deleteMany({ where: { id: categoryId } })
      await prisma.user.deleteMany({ where: { id: { in: [customerId, otherUserId, providerUserId] } } })
    } catch { /* best effort */ }
    await prisma.$disconnect()
  })

  beforeEach(() => {
    mockUser.current = { id: customerId, countryCode: 'LK' }
  })

  async function makeJob(data: {
    countryCode: string
    latitude?: number | null
    longitude?: number | null
    status?: string
    withEscrow?: boolean
  }) {
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: `P03GET Job ${ts}`,
        description: 'payment GET acceptance',
        categoryId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 5000n,
        status: data.status || 'QUOTE_ACCEPTED',
        countryCode: data.countryCode,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
    })
    jobIds.push(job.id)

    if (data.withEscrow !== false) {
      const quote = await prisma.jobQuote.create({
        data: {
          jobId: job.id,
          providerId: providerUserId,
          providerType: 'INDIVIDUAL',
          price: 5000n,
          estimatedCompletionTime: '1 day',
          attachments: '[]',
          status: 'ACCEPTED',
        },
      })
      const escrow = await prisma.jobEscrow.create({
        data: {
          jobId: job.id,
          quoteId: quote.id,
          customerId,
          providerId: providerUserId,
          currency: data.countryCode === 'CA' ? 'CAD' : 'LKR',
          amount: 5000n,
          serviceFee: 500n,
          totalAmount: 5500n,
          status: 'PROTECTED',
          paymentMethod: 'CARD',
        },
      })
      escrowIds.push(escrow.id)
    }
    return job
  }

  it('unauthenticated access is rejected', async () => {
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO })
    mockUser.current = null
    const { status } = await callGet(job.id)
    expect(status).toBe(401)
  })

  it('a non-owner cannot read another customer payment options', async () => {
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO })
    mockUser.current = { id: otherUserId, countryCode: 'LK' }
    const { status } = await callGet(job.id)
    expect(status).toBe(403)
  })

  it('rejects a Vancouver-excluded address stored as Canadian', async () => {
    const job = await makeJob({ countryCode: 'CA', ...BURNABY })
    const get = await callGet(job.id)
    // Out-of-municipal-boundary coordinates offer nothing, and say why.
    expect(get.status).toBe(200)
    expect(get.body.options).toBeNull()
    expect(get.body.market.valid).toBe(false)
    expect(get.body.market.code).toBe('JOB_MARKET_UNRESOLVED')
  })

  it('rejects a stored-country / coordinate disagreement', async () => {
    const job = await makeJob({ countryCode: 'LK', ...VANCOUVER })
    const get = await callGet(job.id)
    // GET is a READ: it must not offer payment options for a market POST refuses.
    expect(get.status).toBe(200)
    expect(get.body.options).toBeNull()
    expect(get.body.market.valid).toBe(false)
    expect(get.body.market.code).toBe('PAYMENT_MARKET_MISMATCH')
  })

  it('GET and POST agree on a mismatched market (no false payment offer)', async () => {
    const job = await makeJob({ countryCode: 'LK', ...VANCOUVER })
    const get = await callGet(job.id)
    const post = await callPost(job.id)

    // POST refuses to CREATE; GET refuses to OFFER. Neither exposes an option.
    expect(post.status).toBe(409)
    expect(post.body.code).toBe('PAYMENT_MARKET_MISMATCH')
    expect(get.status).toBe(200)
    expect(get.body.options).toBeNull()
    expect(get.body.market.code).toBe(post.body.code)
    expect(get.body.cashAvailable).toBeUndefined()
    expect(get.body.onlineAvailable).toBeUndefined()
  })

  it('GET and POST agree on an out-of-market Vancouver address', async () => {
    const job = await makeJob({ countryCode: 'CA', ...BURNABY })
    const get = await callGet(job.id)
    const post = await callPost(job.id)
    // POST refuses to CREATE; GET refuses to OFFER; both name the same reason.
    expect(post.status).toBe(409)
    expect(post.body.code).toBe('JOB_MARKET_UNRESOLVED')
    expect(get.status).toBe(200)
    expect(get.body.options).toBeNull()
    expect(get.body.market.code).toBe(post.body.code)
  })

  it('serves a legitimate coordinate-less legacy Sri Lankan job', async () => {
    const job = await makeJob({ countryCode: 'LK', latitude: null, longitude: null })
    const get = await callGet(job.id)
    expect(get.status).toBe(200)
    expect(get.body).toBeTruthy()
  })

  it('serves a legitimate Vancouver job', async () => {
    const job = await makeJob({ countryCode: 'CA', ...VANCOUVER })
    const get = await callGet(job.id)
    expect(get.status).toBe(200)
  })

  it('does not advertise online payment when no provider is configured', async () => {
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO })
    const get = await callGet(job.id)
    expect(get.status).toBe(200)
    // PayPal/PayHere are unconfigured in this environment: the response must
    // not present online checkout as available.
    const serialised = JSON.stringify(get.body)
    expect(serialised).not.toMatch(/"onlineAvailable"\s*:\s*true/)
    expect(serialised).not.toMatch(/"provider"\s*:\s*"PAYPAL"/)
  })

  it('still exposes historical payment status for a legacy job', async () => {
    const job = await makeJob({ countryCode: 'LK', latitude: null, longitude: null })
    await prisma.paymentIntent.create({
      data: {
        jobId: job.id,
        customerId,
        escrowId: escrowIds[escrowIds.length - 1],
        merchantOrderId: `PP-PENDING-${ts}-hist`,
        gateway: 'PAYPAL',
        amount: 5500n,
        currency: 'LKR',
        status: 'SUCCESS',
      },
    })

    const get = await callGet(job.id)
    expect(get.status).toBe(200)
    // Historical payment information remains readable for an authorized viewer.
    expect(JSON.stringify(get.body)).toContain('PP-PENDING')
  })

  it('a job with no escrow does not fabricate payment availability', async () => {
    const job = await makeJob({ countryCode: 'LK', ...COLOMBO, withEscrow: false })
    const get = await callGet(job.id)
    // Either a clean refusal or a 200 with no invented options; never a false offer.
    if (get.status === 200) {
      expect(JSON.stringify(get.body)).not.toMatch(/"onlineAvailable"\s*:\s*true/)
    }
    expect([200, 409]).toContain(get.status)
  })
})

// ---------------------------------------------------------------------------
// Historical-payment safety: an already-PAID job whose stored country disagrees
// with its coordinates must not expose NEW payment options, but its payment
// history must stay readable to the owning customer.
// ---------------------------------------------------------------------------
describe('historical payment history on a market-mismatched job', () => {
  let ts2 = 0
  let categoryId = ''
  let customerId = ''
  let otherUserId = ''
  let providerUserId = ''
  let job: any
  let escrowId = ''

  beforeAll(async () => {
    ts2 = Date.now()
    const cat = await prisma.jobCategory.create({
      data: {
        name: `P03HIST Cat ${ts2}`,
        slug: `p03hist-cat-${ts2}`,
        iconName: 'wrench',
        colorHex: '#666666',
        countries: '["LK","CA"]',
        isActive: true,
        sortOrder: 0,
      } as never,
    })
    categoryId = (cat as any).id

    const mk = async (countryCode: string, tag: string) =>
      (await prisma.user.create({
        data: {
          email: `p03hist-${tag}-${ts2}@test.local`,
          passwordHash: 'x',
          name: `P03HIST ${tag}`,
          phone: `+9477${String(ts2).slice(-6)}${tag === 'cust' ? '00001' : '00002'}`,
          countryCode,
          identityStatus: 'VERIFIED',
          isActive: true,
        } as never,
      })) as any
    customerId = (await mk('LK', 'histcust')).id
    otherUserId = (await mk('LK', 'histother')).id
    providerUserId = (await mk('LK', 'histprov')).id
    await prisma.taskerProfile.create({
      data: { userId: providerUserId, countryCode: 'LK', isVerified: true, verificationStatus: 'VERIFIED', rating: 4.5, completedJobs: 5 } as never,
    })

    job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: `P03HIST Paid Mismatch ${ts2}`,
        description: 'historical payment safety',
        categoryId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 5000n,
        countryCode: 'LK',
        latitude: VANCOUVER.latitude,
        longitude: VANCOUVER.longitude,
        status: 'IN_PROGRESS',
      } as never,
    })
    const quote = await prisma.jobQuote.create({
      data: { jobId: job.id, providerId: providerUserId, providerType: 'INDIVIDUAL', price: 5000n, estimatedCompletionTime: '1 day', attachments: '[]', status: 'ACCEPTED' } as never,
    })
    const escrow = await prisma.jobEscrow.create({
      data: { jobId: job.id, quoteId: quote.id, customerId, providerId: providerUserId, currency: 'CAD', amount: 5000n, serviceFee: 500n, totalAmount: 5500n, status: 'SETTLED', paymentMethod: 'CASH' } as never,
    })
    escrowId = (escrow as any).id
    // An already-SUCCEEDED payment: money has moved.
    await prisma.paymentIntent.create({
      data: {
        jobId: job.id, customerId, escrowId, merchantOrderId: `PP-PAID-MISMATCH-${ts2}`,
        gateway: 'PAYPAL', amount: 5500n, currency: 'CAD', status: 'SUCCESS',
      } as never,
    })
  })

  afterAll(async () => {
    await prisma.paymentIntent.deleteMany({ where: { jobId: job.id } })
    await prisma.jobEscrow.deleteMany({ where: { jobId: job.id } })
    await prisma.jobQuote.deleteMany({ where: { jobId: job.id } })
    await prisma.marketplaceJob.deleteMany({ where: { id: job.id } })
    await prisma.taskerProfile.deleteMany({ where: { userId: providerUserId } })
    await prisma.providerIdentity.deleteMany({ where: { currentUserId: providerUserId } })
    await prisma.user.deleteMany({ where: { id: { in: [customerId, otherUserId, providerUserId] } } })
    await prisma.jobCategory.deleteMany({ where: { id: categoryId } })
  })

  it('blocks NEW payment options for the invalid market', async () => {
    mockUser.current = { id: customerId }
    const post = await callPost(job.id)
    expect(post.status).toBe(409)
    expect(post.body.code).toBe('PAYMENT_MARKET_MISMATCH')
  })

  it('does not let an unrelated customer read the history', async () => {
    mockUser.current = { id: otherUserId }
    const get = await callGet(job.id)
    expect(get.status).toBe(403)
  })

  it('still lets the owning customer read settled payment history', async () => {
    mockUser.current = { id: customerId }
    const get = await callGet(job.id)
    expect(get.status).toBe(200)
    // The money record stays visible to its owner...
    expect(JSON.stringify(get.body.payment)).toContain(`PP-PAID-MISMATCH-${ts2}`)
    // ...while no NEW payment option is offered.
    expect(get.body.options).toBeNull()
    expect(get.body.market.valid).toBe(false)
  })
})
