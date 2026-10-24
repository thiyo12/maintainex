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
  const dispute = { id: 'marketplace-dispute-1', status: 'OPEN', resolution: null, resolutionAction: null, resolvedAt: null }
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
      upsert: vi.fn(async () => ({ ...dispute })),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (dispute.id !== where.id || dispute.status !== where.status) return { count: 0 }
        Object.assign(dispute, data)
        return { count: 1 }
      }),
    },
    adminAlert: { findFirst: vi.fn(), create: vi.fn() },
  }
  return {
    escrow, job, quote, dispute, tx,
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
    Object.assign(mocks.dispute, { status: 'OPEN', resolution: null, resolutionAction: null, resolvedAt: null })
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
      select: { id: true, status: true, resolution: true, resolutionAction: true, resolvedAt: true },
    })
    expect(mocks.tx.adminAlert.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      assignedRole: 'SUPPORT', targetTable: 'MarketplaceDispute', targetId: 'marketplace-dispute-1',
    }) })
  })

  it('explicitly reopens a resolved financial case for a new cash contest and preserves the prior resolution in history', async () => {
    mocks.actor.mockResolvedValue({ id: 'customer-1' })
    Object.assign(mocks.escrow, { cashCollectionStatus: 'PROVIDER_REPORTED', cashCollectedMinor: 7000n })
    Object.assign(mocks.dispute, {
      status: 'RESOLVED', resolution: 'Earlier evidence reviewed', resolutionAction: 'RELEASE_PROVIDER',
      resolvedAt: new Date('2026-10-20T00:00:00.000Z'),
    })
    mocks.tx.adminAlert.findFirst.mockResolvedValue(null)

    const response = await POST(request('CONTEST'), { params: Promise.resolve({ id: 'job-1' }) })

    expect(response.status).toBe(200)
    expect(mocks.tx.marketplaceDispute.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'marketplace-dispute-1', status: 'RESOLVED' },
      data: expect.objectContaining({ status: 'OPEN', resolution: null, resolvedAt: null }),
    }))
    expect(mocks.lifecycleEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'FINANCIAL_DISPUTE_REOPENED', fromState: 'RESOLVED', toState: 'OPEN',
      metadata: expect.objectContaining({
        disputeId: 'marketplace-dispute-1', previousResolution: 'Earlier evidence reviewed',
        previousResolutionAction: 'RELEASE_PROVIDER',
      }),
    }))
    expect(mocks.tx.adminAlert.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      title: 'Cash collection dispute reopened', targetId: 'marketplace-dispute-1',
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
