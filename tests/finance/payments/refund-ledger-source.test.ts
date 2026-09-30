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
    status: 'REFUND_REQUIRED',
    gatewayResponse: null,
    ...overrides,
  }
}

describe('external refund ledger source finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.paymentIntentFindUnique.mockResolvedValue(paymentIntent())
    mocks.tx.paymentIntent.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.paymentIntent.findUnique.mockResolvedValue({ status: 'REFUNDED' })
    mocks.tx.jobEscrow.updateMany.mockResolvedValue({ count: 1 })
    mocks.postLedgerTransaction.mockResolvedValue(undefined)
    mocks.recordJobLifecycleEvent.mockResolvedValue(undefined)
  })

  it('clears refund suspense for a late capture without touching escrow state', async () => {
    mocks.financialLedgerFindFirst.mockResolvedValue({
      id: 'ledger-suspense-1',
      amount: 10000n,
      currency: 'LKR',
    })
    mocks.jobEscrowFindUnique.mockResolvedValue(null)

    const { confirmManualExternalRefund } = await import('@/lib/payment/payment-service')
    const result = await confirmManualExternalRefund('pi-1', {
      actorId: 'admin-1',
      reference: 'BANK-REF-1001',
      note: 'Customer refunded outside PayHere',
    })

    expect(result).toEqual({
      success: true,
      status: 'REFUNDED',
      refundReference: 'BANK-REF-1001',
    })
    expect(mocks.jobEscrowFindUnique).not.toHaveBeenCalled()
    expect(mocks.tx.jobEscrow.updateMany).not.toHaveBeenCalled()
    expect(mocks.postLedgerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [
          expect.objectContaining({
            accountId: 'refund-suspense:pi-1',
            accountType: 'REFUND_SUSPENSE',
            entryType: 'DEBIT',
            amount: 10000n,
          }),
          expect.objectContaining({
            accountId: 'external:payhere',
            accountType: 'EXTERNAL_PAYOUT',
            entryType: 'CREDIT',
            amount: 10000n,
          }),
        ],
        currency: 'LKR',
        referenceType: 'PAYMENT_EXTERNAL_REFUND',
        referenceId: 'pi-1',
      }),
      mocks.tx,
    )
    expect(mocks.recordJobLifecycleEvent).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        jobId: 'job-1',
        actorId: 'admin-1',
        actorType: 'STAFF',
        action: 'PAYMENT_REFUNDED',
        metadata: expect.objectContaining({
          fundingSource: 'REFUND_SUSPENSE',
          refundMinor: 10000n,
        }),
      })
    )
  })

  it('debits protected escrow for a normal external refund', async () => {
    mocks.financialLedgerFindFirst.mockResolvedValue(null)
    mocks.jobEscrowFindUnique.mockResolvedValue({
      id: 'escrow-1',
      status: 'ON_HOLD',
      totalAmount: 10000n,
      currency: 'LKR',
    })

    const { confirmManualExternalRefund } = await import('@/lib/payment/payment-service')
    const result = await confirmManualExternalRefund('pi-1', {
      actorId: 'admin-1',
      reference: 'BANK-REF-1002',
    })

    expect(result.status).toBe('REFUNDED')
    expect(mocks.tx.jobEscrow.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'escrow-1',
          status: { in: ['ON_HOLD', 'PROTECTED'] },
        },
        data: expect.objectContaining({ status: 'REFUNDED' }),
      })
    )
    expect(mocks.postLedgerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [
          expect.objectContaining({
            accountId: 'escrow:escrow-1',
            accountType: 'ESCROW',
            entryType: 'DEBIT',
            amount: 10000n,
          }),
          expect.objectContaining({
            accountId: 'external:payhere',
            accountType: 'EXTERNAL_PAYOUT',
            entryType: 'CREDIT',
            amount: 10000n,
          }),
        ],
        currency: 'LKR',
        referenceType: 'ESCROW_EXTERNAL_REFUND',
        referenceId: 'escrow-1',
      }),
      mocks.tx,
    )
  })

  it('fails closed when escrow no longer matches the captured payment', async () => {
    mocks.financialLedgerFindFirst.mockResolvedValue(null)
    mocks.jobEscrowFindUnique.mockResolvedValue({
      id: 'escrow-1',
      status: 'ON_HOLD',
      totalAmount: 9000n,
      currency: 'LKR',
    })

    const { confirmManualExternalRefund } = await import('@/lib/payment/payment-service')
    const result = await confirmManualExternalRefund('pi-1', {
      actorId: 'admin-1',
      reference: 'BANK-REF-1003',
    })

    expect(result).toMatchObject({
      success: false,
      code: 'REFUND_ESCROW_MISMATCH',
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled()
  })
})
