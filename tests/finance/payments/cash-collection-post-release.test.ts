import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  const escrow = {
    id: 'escrow-1', jobId: 'job-1', paymentMethod: 'CASH', status: 'RELEASED',
    amount: 10000n, totalAmount: 10000n, currency: 'LKR',
    cashCollectionStatus: 'CUSTOMER_CONFIRMED', cashCollectedMinor: 4000n,
    cashReportedBy: 'provider-1', cashCollectionConfirmedAt: new Date(),
  }
  const job = { id: 'job-1', customerId: 'customer-1', status: 'COMPLETED', countryCode: 'LK' }
  const quote = { id: 'quote-1', providerId: 'provider-1', providerType: 'INDIVIDUAL', status: 'ACCEPTED' }
  const tx = {
    jobEscrow: {
      findUnique: vi.fn(async () => escrow),
      findUniqueOrThrow: vi.fn(async () => escrow),
      updateMany: vi.fn(async ({ data }: any) => { Object.assign(escrow, data); return { count: 1 } }),
    },
    jobLifecycleEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    marketplaceDispute: {
      upsert: vi.fn(async () => ({ id: 'marketplace-dispute-1' })),
    },
    adminAlert: { findFirst: vi.fn(), create: vi.fn() },
  }
  return {
    escrow, job, quote, tx,
    prisma: {
      marketplaceJob: { findUnique: vi.fn(async () => job) },
      jobEscrow: { findFirst: vi.fn(async () => escrow) },
      jobQuote: { findFirst: vi.fn(async () => quote) },
      $transaction: vi.fn(async (callback: (arg: typeof tx) => unknown) => callback(tx)),
    },
    actor: vi.fn(),
    lifecycleEvent: vi.fn(async (_tx: unknown, input: any) => ({ id: `event-${input.action}` })),
    receivable: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: mocks.actor,
  assertNotSuspended: vi.fn(() => null),
}))
vi.mock('@/lib/rate-limit/financial-guard', () => ({ requireFinancialRateLimit: vi.fn(async () => null) }))
vi.mock('@/lib/domain/job-lifecycle-audit', () => ({ recordJobLifecycleEvent: mocks.lifecycleEvent }))
vi.mock('@/lib/domain/job-lifecycle', () => ({
  hasCompanyJobManagement: vi.fn(async () => false),
  isAssignedCompanyWorker: vi.fn(async () => false),
}))
vi.mock('@/lib/finance/commissions/provider-balance-service', () => ({ recordCashPlatformReceivable: mocks.receivable }))
vi.mock('@/lib/finance/payments/provider-registry', () => ({ isCashPaymentAvailableForMarket: vi.fn(() => true) }))
vi.mock('@/lib/finance/payments/payment-service', () => ({ resolvePaymentMarketForIntent: vi.fn(() => ({ ok: true, countryCode: 'LK' })) }))

import { POST } from '@/app/api/mobile/v2/jobs/[id]/cash-collection/route'

function request(action: string, amountMinor?: string) {
  return new NextRequest('https://maintainex.test/api/mobile/v2/jobs/job-1/cash-collection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, amountMinor }),
  })
}

describe('post-completion cash collection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mocks.escrow, {
      status: 'RELEASED', cashCollectionStatus: 'CUSTOMER_CONFIRMED', cashCollectedMinor: 4000n,
      cashReportedBy: 'provider-1',
    })
    mocks.actor.mockResolvedValue({ id: 'provider-1' })
    mocks.tx.jobEscrow.updateMany.mockImplementation(async ({ data }: any) => {
      Object.assign(mocks.escrow, data)
      return { count: 1 }
    })
  })

  it('records a later cumulative provider report without changing completed escrow or commission', async () => {
    const response = await POST(request('REPORT', '7000'), { params: Promise.resolve({ id: 'job-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.escrow.status).toBe('RELEASED')
    expect(mocks.escrow.cashCollectionStatus).toBe('PROVIDER_REPORTED')
    expect(mocks.escrow.cashCollectedMinor).toBe(7000n)
    expect(mocks.receivable).not.toHaveBeenCalled()
    expect(mocks.lifecycleEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'CASH_COLLECTION_REPORTED',
    }))
  })

  it('posts only the incremental commission after customer confirmation', async () => {
    mocks.actor.mockResolvedValue({ id: 'customer-1' })
    Object.assign(mocks.escrow, { cashCollectionStatus: 'PROVIDER_REPORTED', cashCollectedMinor: 7000n })
    mocks.tx.jobLifecycleEvent.findFirst.mockResolvedValue({
      metadata: JSON.stringify({ escrowId: 'escrow-1', cashCollectedMinor: '4000', commissionRateBps: '1000' }),
    })
    mocks.tx.jobLifecycleEvent.findMany.mockResolvedValue([
      { metadata: JSON.stringify({ escrowId: 'escrow-1', amountMinor: '4000' }) },
    ])
    const response = await POST(request('CONFIRM'), { params: Promise.resolve({ id: 'job-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.receivable).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({
      platformDueMinor: 300n,
      collectionEventId: 'event-CASH_COLLECTION_CONFIRMED',
      escrowId: 'escrow-1',
    }))
    expect(mocks.lifecycleEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'CASH_COMMISSION_ADJUSTED',
    }))
  })

  it('keeps commission unchanged and returns review state for a post-completion contest', async () => {
    mocks.actor.mockResolvedValue({ id: 'customer-1' })
    Object.assign(mocks.escrow, { cashCollectionStatus: 'PROVIDER_REPORTED', cashCollectedMinor: 7000n })
    mocks.tx.adminAlert.findFirst.mockResolvedValue(null)
    const response = await POST(request('CONTEST'), { params: Promise.resolve({ id: 'job-1' }) })
    expect(response.status).toBe(200)
    expect(mocks.receivable).not.toHaveBeenCalled()
    expect(mocks.tx.marketplaceDispute.upsert).toHaveBeenCalledWith({
      where: { jobId: 'job-1' },
      create: expect.objectContaining({
        escrowId: 'escrow-1',
        raisedById: 'customer-1',
        reason: 'CASH_COLLECTION_CONTESTED',
        status: 'OPEN',
        countryCode: 'LK',
      }),
      update: {},
      select: { id: true },
    })
    expect(mocks.tx.adminAlert.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      assignedRole: 'SUPPORT', targetTable: 'MarketplaceDispute', targetId: 'marketplace-dispute-1',
    }) })
  })

  it('does not apply a lower cumulative amount as an automatic commission reversal', async () => {
    mocks.actor.mockResolvedValue({ id: 'customer-1' })
    Object.assign(mocks.escrow, { cashCollectionStatus: 'PROVIDER_REPORTED', cashCollectedMinor: 3500n })
    mocks.tx.jobLifecycleEvent.findFirst.mockResolvedValue({
      metadata: JSON.stringify({ escrowId: 'escrow-1', cashCollectedMinor: '4000', commissionRateBps: '1000' }),
    })
    mocks.tx.jobLifecycleEvent.findMany.mockResolvedValue([
      { metadata: JSON.stringify({ escrowId: 'escrow-1', amountMinor: '4000' }) },
    ])
    const response = await POST(request('CONFIRM'), { params: Promise.resolve({ id: 'job-1' }) })
    expect(response.status).toBe(409)
    expect(mocks.receivable).not.toHaveBeenCalled()
  })
})
