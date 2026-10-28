import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx: any = {
    paymentIntent: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    jobEscrow: {
      updateMany: vi.fn(),
    },
    marketplaceDispute: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    adminAlert: {
      updateMany: vi.fn(),
    },
  }

  return {
    tx,
    paymentIntentFindUnique: vi.fn(),
    financialLedgerFindFirst: vi.fn(),
    jobEscrowFindUnique: vi.fn(),
    transaction: vi.fn(async (fn: any) => fn(tx)),
    postLedgerTransaction: vi.fn(),
    recordJobLifecycleEvent: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentIntent: {
      findUnique: mocks.paymentIntentFindUnique,
    },
    financialLedger: {
      findFirst: mocks.financialLedgerFindFirst,
    },
    jobEscrow: {
      findUnique: mocks.jobEscrowFindUnique,
    },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/finance/ledger/ledger-service', () => ({
  postLedgerTransaction: mocks.postLedgerTransaction,
}))

vi.mock('@/lib/domain/job-lifecycle-audit', () => ({
  recordJobLifecycleEvent: mocks.recordJobLifecycleEvent,
}))

function paymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi-1',
    jobId: 'job-1',
    customerId: 'customer-1',
    escrowId: 'escrow-1',
    merchantOrderId: 'order-1',
    paymentId: 'pay-1',
    amount: 10000n,
    currency: 'LKR',
    gateway: 'MANUAL_BANK',
    status: 'REFUND_REQUIRED',
    gatewayResponse: null,
    ...overrides,
  }
}

describe('external refund evidence gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.paymentIntentFindUnique.mockResolvedValue(paymentIntent())
    mocks.tx.paymentIntent.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.paymentIntent.findUnique.mockResolvedValue({ status: 'REFUNDED' })
    mocks.tx.jobEscrow.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.marketplaceDispute.findFirst.mockResolvedValue(null)
    mocks.tx.marketplaceDispute.update.mockResolvedValue({})
    mocks.tx.adminAlert.updateMany.mockResolvedValue({ count: 0 })
    mocks.postLedgerTransaction.mockResolvedValue(undefined)
    mocks.recordJobLifecycleEvent.mockResolvedValue(undefined)
  })

  it('does not finalize a refund from a staff-entered reference without external evidence', async () => {
    const { confirmManualExternalRefund } = await import('@/lib/payment/payment-service')
    const result = await confirmManualExternalRefund('pi-1', {
      actorId: 'admin-1',
      reference: 'BANK-REF-1001',
    })

    expect(result).toMatchObject({
      success: false,
      code: 'REFUND_EXTERNAL_EVIDENCE_REQUIRED',
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled()
  })

  it('keeps retired gateway records read-only without changing ledger or payment state', async () => {
    mocks.paymentIntentFindUnique.mockResolvedValue(paymentIntent({ gateway: 'PAYHERE' }))

    const { confirmManualExternalRefund } = await import('@/lib/payment/payment-service')
    const result = await confirmManualExternalRefund('pi-1', {
      actorId: 'admin-1',
      reference: 'BANK-REF-1004',
    })

    expect(result).toMatchObject({ success: false, code: 'PAYMENT_PROVIDER_RETIRED' })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled()
  })
})
