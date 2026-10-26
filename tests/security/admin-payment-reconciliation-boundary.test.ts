import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  intent: vi.fn(),
  job: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}))

vi.mock('@/lib/crm/security', () => ({
  assertCrmCountryAllowed: vi.fn(() => true),
  guardCrmRequest: mocks.guard,
  redactCrmSensitiveData: (value: unknown) => value,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentIntent: { findUnique: mocks.intent },
    marketplaceJob: { findUnique: mocks.job },
    paymentProviderTransaction: { findUnique: mocks.transaction, update: mocks.update },
  },
}))
vi.mock('@/lib/crm/audit', () => ({ createAuditLog: mocks.audit }))

import { PATCH } from '@/app/api/admin/financial/payments/[id]/route'

const security = {
  adminId: 'synthetic-finance-admin', sessionId: 'synthetic-session',
  email: 'finance@test.local', role: 'FINANCE', permissionOverrides: [],
  ipAddress: '127.0.0.1', userAgent: 'synthetic-test',
}

function request(gateway: string, reconciliationStatus = 'MATCHED') {
  mocks.intent.mockResolvedValue({
    id: 'synthetic-intent', jobId: 'synthetic-job', customerId: 'synthetic-customer',
    gateway, merchantOrderId: 'synthetic-order', amount: 15000n, currency: 'LKR', status: 'SUCCESS',
  })
  mocks.job.mockResolvedValue({ id: 'synthetic-job', countryCode: 'LK', status: 'COMPLETED' })
  mocks.transaction.mockResolvedValue({
    id: 'synthetic-transaction', paymentIntentId: 'synthetic-intent', jobId: 'synthetic-job',
    countryCode: 'LK', provider: gateway, currency: 'LKR', grossAmount: 15000n,
    reconciliationStatus: 'UNRECONCILED', reconciliationReference: null,
  })
  mocks.update.mockImplementation(async ({ data }) => ({
    id: 'synthetic-transaction', ...data, grossAmount: 15000n,
  }))
  return new NextRequest('https://maintainex.test/api/admin/financial/payments/synthetic-intent', {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      transactionId: 'synthetic-transaction', reconciliationStatus,
      reference: 'operator typed ref 123', reason: 'operator assertion only',
    }),
  })
}

describe('admin provider-payment reconciliation evidence boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.guard.mockResolvedValue({ ok: true, context: security })
  })

  it('keeps retired PayHere records read-only', async () => {
    const response = await PATCH(request('PAYHERE'), { params: Promise.resolve({ id: 'synthetic-intent' }) })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_PROVIDER_RETIRED' })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('rejects a matched state based only on an operator-entered reference', async () => {
    const response = await PATCH(request('FUTURE_PROVIDER'), { params: Promise.resolve({ id: 'synthetic-intent' }) })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'PAYMENT_RECONCILIATION_EVIDENCE_REQUIRED' })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('still allows authorized finance staff to flag a mismatch for review', async () => {
    const response = await PATCH(request('FUTURE_PROVIDER', 'MANUAL_REVIEW'), { params: Promise.resolve({ id: 'synthetic-intent' }) })

    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reconciliationStatus: 'MANUAL_REVIEW' }),
    }))
  })
})
