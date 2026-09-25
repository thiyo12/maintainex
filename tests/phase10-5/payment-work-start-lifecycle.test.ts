import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx: any = {
    paymentIntent: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    jobEscrow: { updateMany: vi.fn() },
    marketplaceRiskEvent: { create: vi.fn() },
    jobLifecycleEvent: { create: vi.fn() },
    $queryRaw: vi.fn(),
  }

  return {
    tx,
    paymentIntentFindFirst: vi.fn(),
    paymentIntentUpdateMany: vi.fn(),
    jobEscrowFindUnique: vi.fn(),
    transaction: vi.fn(async (fn: any) => fn(tx)),
    postLedgerTransaction: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentIntent: {
      findFirst: mocks.paymentIntentFindFirst,
      updateMany: mocks.paymentIntentUpdateMany,
    },
    jobEscrow: { findUnique: mocks.jobEscrowFindUnique },
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
  parsePayHereAmount: vi.fn((value: string) => {
    const amount = Number.parseFloat(value)
    return Number.isFinite(amount) && amount > 0 ? BigInt(Math.round(amount * 100)) : null
  }),
}))

function notification(overrides: Record<string, unknown> = {}) {
  return {
    merchant_id: 'test',
    order_id: 'order-1',
    payhere_amount: '100.00',
    payhere_currency: 'LKR',
    status_code: '2',
    md5sig: 'sig',
    payment_id: 'pay-1',
    custom_1: 'job-1',
    ...overrides,
  } as any
}

describe('PayHere payment-to-work lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.paymentIntentFindFirst.mockResolvedValue({
      id: 'pi-1',
      jobId: 'job-1',
      customerId: 'customer-1',
      escrowId: 'escrow-1',
      merchantOrderId: 'order-1',
      paymentId: null,
      amount: 10000n,
      currency: 'LKR',
      status: 'PENDING',
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

    mocks.tx.$queryRaw.mockResolvedValue([
      { id: 'job-1', customerId: 'customer-1', status: 'QUOTE_ACCEPTED' },
    ])
    mocks.tx.paymentIntent.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.paymentIntent.findUnique.mockResolvedValue({ status: 'REFUND_REQUIRED' })
    mocks.tx.jobEscrow.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.marketplaceRiskEvent.create.mockResolvedValue({ id: 'risk-1' })
    mocks.paymentIntentUpdateMany.mockResolvedValue({ count: 1 })
    mocks.postLedgerTransaction.mockResolvedValue(undefined)
  })

  it('protects escrow but does not start the job or company assignment', async () => {
    const { processPaymentSuccess } = await import('@/lib/payment/payment-service')

    const result = await processPaymentSuccess(notification())

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
    expect(mocks.postLedgerTransaction).toHaveBeenCalledTimes(1)
  })

  it('records a late captured payment as REFUND_REQUIRED after cancellation', async () => {
    const { processPaymentSuccess } = await import('@/lib/payment/payment-service')

    mocks.paymentIntentFindFirst.mockResolvedValue({
      id: 'pi-1',
      jobId: 'job-1',
      customerId: 'customer-1',
      escrowId: 'escrow-1',
      merchantOrderId: 'order-1',
      paymentId: null,
      amount: 10000n,
      currency: 'LKR',
      status: 'CANCELLED',
    })

    const result = await processPaymentSuccess(notification({ payment_id: 'late-pay-1' }))

    expect(result).toEqual({ success: true })
    expect(mocks.tx.paymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'pi-1' }),
        data: expect.objectContaining({
          status: 'REFUND_REQUIRED',
          paymentId: 'late-pay-1',
        }),
      })
    )
    expect(mocks.tx.marketplaceRiskEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: 'job-1',
          eventType: 'LATE_PAYMENT_REFUND_REQUIRED',
          severity: 'CRITICAL',
        }),
      })
    )
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled()
  })

  it('rejects callbacks whose amount does not match the payment intent', async () => {
    const { processPaymentSuccess } = await import('@/lib/payment/payment-service')

    const result = await processPaymentSuccess(notification({ payhere_amount: '99.00' }))

    expect(result).toEqual({ success: false, error: 'Payment amount mismatch' })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled()
  })

  it('keeps PayHere status code 0 as PENDING instead of FAILED', async () => {
    const { processPaymentFailure } = await import('@/lib/payment/payment-service')

    const result = await processPaymentFailure(notification({ status_code: '0' }))

    expect(result).toEqual({ success: true })
    expect(mocks.paymentIntentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pi-1', status: { in: ['CREATED', 'PENDING'] } },
        data: expect.objectContaining({ status: 'PENDING' }),
      })
    )
  })

  it('moves a protected escrow to ON_HOLD on chargeback and raises a critical risk event', async () => {
    const { processPaymentFailure } = await import('@/lib/payment/payment-service')

    mocks.paymentIntentFindFirst.mockResolvedValue({
      id: 'pi-1',
      jobId: 'job-1',
      customerId: 'customer-1',
      escrowId: 'escrow-1',
      merchantOrderId: 'order-1',
      paymentId: 'pay-1',
      amount: 10000n,
      currency: 'LKR',
      status: 'SUCCESS',
    })

    const result = await processPaymentFailure(notification({
      status_code: '-3',
      status_message: 'Chargedback',
    }))

    expect(result).toEqual({ success: true })
    expect(mocks.tx.paymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pi-1', status: { not: 'CHARGEDBACK' } },
        data: expect.objectContaining({ status: 'CHARGEDBACK' }),
      })
    )
    expect(mocks.tx.jobEscrow.updateMany).toHaveBeenCalledWith({
      where: { id: 'escrow-1', status: 'PROTECTED' },
      data: { status: 'ON_HOLD' },
    })
    expect(mocks.tx.marketplaceRiskEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'PAYMENT_CHARGEBACK',
          severity: 'CRITICAL',
        }),
      })
    )
  })
})
