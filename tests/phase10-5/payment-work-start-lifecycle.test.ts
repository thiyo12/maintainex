import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx: any = {
    paymentIntent: { updateMany: vi.fn() },
    jobEscrow: { updateMany: vi.fn() },
    marketplaceJob: { updateMany: vi.fn(), findUnique: vi.fn() },
    companyJobAssignment: { updateMany: vi.fn() },
  }
  return {
    tx,
    paymentIntentFindFirst: vi.fn(),
    jobEscrowFindUnique: vi.fn(),
    marketplaceJobFindUnique: vi.fn(),
    customerWalletUpsert: vi.fn(),
    transaction: vi.fn(async (fn: any) => fn(tx)),
    postLedgerTransaction: vi.fn(),
    queryRaw: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentIntent: { findFirst: mocks.paymentIntentFindFirst },
    jobEscrow: { findUnique: mocks.jobEscrowFindUnique },
    marketplaceJob: { findUnique: mocks.marketplaceJobFindUnique },
    customerWallet: { upsert: mocks.customerWalletUpsert },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/ledger', () => ({
  postLedgerTransaction: mocks.postLedgerTransaction,
}))

vi.mock('@/lib/payment/payhere-adapter', () => ({
  getPayHereConfig: vi.fn(() => ({
    merchantId: 'test',
    merchantSecret: 'secret',
    sandbox: true,
  })),
  generateCheckoutHash: vi.fn(() => 'hash'),
  getPayHereCheckoutUrl: vi.fn(() => 'https://sandbox.payhere.lk/pay/checkout'),
  getPayHereReturnUrl: vi.fn(() => 'https://example.test/return'),
  getPayHereCancelUrl: vi.fn(() => 'https://example.test/cancel'),
  getPayHereNotifyUrl: vi.fn(() => 'https://example.test/notify'),
  generateMerchantOrderId: vi.fn(() => 'order-1'),
  formatPayHereAmount: vi.fn(() => '100.00'),
}))

describe('PayHere payment-to-work lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.paymentIntentFindFirst.mockResolvedValue({
      id: 'pi-1',
      jobId: 'job-1',
      customerId: 'customer-1',
      escrowId: 'escrow-1',
      merchantOrderId: 'order-1',
      amount: 10000n,
      currency: 'LKR',
      status: 'PENDING',
    })

    mocks.marketplaceJobFindUnique.mockResolvedValue({
      id: 'job-1',
      customerId: 'customer-1',
      status: 'QUOTE_ACCEPTED',
    })

    mocks.jobEscrowFindUnique.mockResolvedValue({
      id: 'escrow-1',
      jobId: 'job-1',
      customerId: 'customer-1',
      providerId: 'provider-1',
      amount: 10000n,
      serviceFee: 0n,
      totalAmount: 10000n,
      currency: 'LKR',
      status: 'PENDING_PAYMENT',
    })

    mocks.customerWalletUpsert.mockResolvedValue({ id: 'wallet-1' })
    mocks.tx.$queryRaw = vi.fn().mockResolvedValue([
      { id: 'job-1', customerId: 'customer-1', status: 'QUOTE_ACCEPTED' },
    ])
    mocks.tx.paymentIntent.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.jobEscrow.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.marketplaceJob.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.companyJobAssignment.updateMany.mockResolvedValue({ count: 1 })
    mocks.postLedgerTransaction.mockResolvedValue(undefined)
  })

  it('protects escrow but does not start the job or company assignment', async () => {
    const { processPaymentSuccess } = await import('@/lib/payment/payment-service')

    const result = await processPaymentSuccess({
      merchant_id: 'test',
      order_id: 'order-1',
      payhere_amount: '100.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: 'sig',
      payment_id: 'pay-1',
    } as any)

    expect(result).toEqual({ success: true })

    expect(mocks.tx.paymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pi-1', status: { in: ['CREATED', 'PENDING'] } },
        data: expect.objectContaining({ status: 'SUCCESS' }),
      })
    )

    expect(mocks.tx.jobEscrow.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'escrow-1',
          jobId: 'job-1',
          customerId: 'customer-1',
          status: 'PENDING_PAYMENT',
        },
        data: expect.objectContaining({ status: 'PROTECTED' }),
      })
    )

    expect(mocks.tx.marketplaceJob.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.companyJobAssignment.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a late success callback after the booking was cancelled', async () => {
    const { processPaymentSuccess } = await import('@/lib/payment/payment-service')

    mocks.marketplaceJobFindUnique.mockResolvedValue({
      id: 'job-1',
      customerId: 'customer-1',
      status: 'CANCELLED',
    })
    mocks.jobEscrowFindUnique.mockResolvedValue({
      id: 'escrow-1',
      jobId: 'job-1',
      customerId: 'customer-1',
      providerId: 'provider-1',
      amount: 10000n,
      serviceFee: 0n,
      totalAmount: 10000n,
      currency: 'LKR',
      status: 'CANCELLED',
    })

    const result = await processPaymentSuccess({
      merchant_id: 'test',
      order_id: 'order-1',
      payhere_amount: '100.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: 'sig',
      payment_id: 'late-pay-1',
      custom_1: 'job-1',
    } as any)

    expect(result.success).toBe(false)
    expect(result.error).toContain('no longer payable')
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled()
  })

  it('rejects signed callbacks whose amount does not match the payment intent', async () => {
    const { processPaymentSuccess } = await import('@/lib/payment/payment-service')

    const result = await processPaymentSuccess({
      merchant_id: 'test',
      order_id: 'order-1',
      payhere_amount: '99.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: 'sig',
      payment_id: 'pay-wrong-amount',
      custom_1: 'job-1',
    } as any)

    expect(result).toEqual({ success: false, error: 'Payment amount mismatch' })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled()
  })
})
