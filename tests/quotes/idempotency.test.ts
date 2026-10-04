import { describe, it, expect, vi, beforeEach } from 'vitest'
import { approveChangeOrder, rejectChangeOrder, cancelChangeOrder } from '@/lib/domain/change-order'

function mockPrisma(opts: {
  changeOrder?: Record<string, any> | null
  job?: Record<string, any>
  quote?: Record<string, any>
  idempotencyRecord?: Record<string, any> | null
  acceptedQuote?: Record<string, any>
} = {}) {
  const jobDefault = {
    id: 'job-1',
    customerId: 'customer-1',
    status: 'QUOTE_ACCEPTED',
    finalAuthorizedAmountCents: null,
    approvedQuoteId: 'quote-1',
    countryCode: 'LK',
  }

  const job = opts.job ?? jobDefault

  const changeOrderDefault = {
    id: 'co-1',
    status: 'SUBMITTED',
    jobId: 'job-1',
    amountDeltaCents: 5000n,
    baseQuoteId: 'quote-1',
    createdBy: 'provider-1',
    revisionNumber: 1,
    job: {
      customerId: job.customerId,
      finalAuthorizedAmountCents: job.finalAuthorizedAmountCents,
      countryCode: job.countryCode ?? 'LK',
      status: job.status ?? 'QUOTE_ACCEPTED',
    },
  }

  const co = opts.changeOrder !== undefined
    ? (opts.changeOrder === null ? null : {
        ...opts.changeOrder,
        job: {
          customerId: job.customerId,
          finalAuthorizedAmountCents: job.finalAuthorizedAmountCents,
          countryCode: job.countryCode ?? 'LK',
          status: job.status ?? 'QUOTE_ACCEPTED',
        },
      })
    : changeOrderDefault

  const quoteDefault = {
    id: 'quote-1',
    jobId: 'job-1',
    providerId: 'provider-1',
    price: 10000n,
    status: 'ACCEPTED',
  }

  const txMocks = {
    jobChangeOrder: {
      update: vi.fn().mockResolvedValue({ id: 'co-1', status: 'APPROVED', customerDecisionAt: new Date(), approvedByCustomerId: 'customer-1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ id: 'co-1', status: 'APPROVED', amountDeltaCents: 5000n }),
      findMany: vi.fn().mockResolvedValue([{ id: 'co-1', status: 'APPROVED', amountDeltaCents: 5000n }]),
    },
    marketplaceJob: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(job),
    },
    jobQuote: {
      findUnique: vi.fn().mockResolvedValue(opts.quote ?? quoteDefault),
    },
    jobEscrow: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'escrow-1',
        jobId: 'job-1',
        status: 'PENDING_PAYMENT',
        paymentMethod: 'ONLINE',
        currency: 'LKR',
        amount: 10000n,
        serviceFee: 1000n,
        totalAmount: 11000n,
        createdAt: new Date(),
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    paymentIntent: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    marketConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    idempotencyRecord: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  }

  const idempotencyReturnValue = opts.idempotencyRecord === undefined ? null : opts.idempotencyRecord

  return {
    jobChangeOrder: {
      findUnique: vi.fn().mockResolvedValue(co),
      update: vi.fn().mockResolvedValue({}),
    },
    jobQuote: {
      findFirst: vi.fn().mockResolvedValue(opts.acceptedQuote ?? { id: 'quote-1', providerId: 'provider-1' }),
    },
    idempotencyRecord: {
      findFirst: vi.fn().mockResolvedValue(idempotencyReturnValue),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn: any) => fn(txMocks)),
  } as any
}

describe('Change order idempotency', () => {
  describe('approveChangeOrder', () => {
    it('approves a submitted change order', async () => {
      const prisma = mockPrisma()
      const result = await approveChangeOrder(prisma, 'co-1', 'customer-1')
      expect(result.success).toBe(true)
    })

    it('rejects approval from non-customer', async () => {
      const prisma = mockPrisma()
      const result = await approveChangeOrder(prisma, 'co-1', 'wrong-user')
      expect(result.success).toBe(false)
      expect(result.error).toBe('NOT_CUSTOMER')
    })

    it('rejects approval of non-submitted change order', async () => {
      const prisma = mockPrisma({
        changeOrder: { id: 'co-1', status: 'DRAFT', jobId: 'job-1' },
      })
      const result = await approveChangeOrder(prisma, 'co-1', 'customer-1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('INVALID_STATUS')
    })

    it('returns cached result on idempotent replay', async () => {
      const prisma = mockPrisma({
        idempotencyRecord: {
          status: 'COMPLETED',
          resultPayload: JSON.stringify({ changeOrder: { id: 'co-1' }, finalAuthorizedAmountCents: '15000' }),
          requestFingerprint: 'APPROVE:co-1:customer-1:5000:quote-1',
          expiresAt: new Date(Date.now() + 86400000),
        },
      })
      const result = await approveChangeOrder(prisma, 'co-1', 'customer-1', 'idem-key-1')
      expect(result.success).toBe(true)
      expect(result.changeOrder).toEqual({ id: 'co-1' })
      expect(result.finalAuthorizedAmountCents).toBe(15000n)
    })

    it('rejects concurrent duplicate with PENDING idempotency', async () => {
      const prisma = mockPrisma({
        idempotencyRecord: { status: 'PENDING', expiresAt: new Date(Date.now() + 86400000) },
      })
      const result = await approveChangeOrder(prisma, 'co-1', 'customer-1', 'idem-key-1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('CONCURRENT_APPROVAL')
    })

    it('returns error when change order not found', async () => {
      const prisma = mockPrisma({ changeOrder: null })
      const result = await approveChangeOrder(prisma, 'nonexistent', 'customer-1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Change order not found')
    })

    it('returns IDEMPOTENCY_CONFLICT when same key has different fingerprint', async () => {
      const prisma = mockPrisma({
        idempotencyRecord: {
          status: 'COMPLETED',
          resultPayload: JSON.stringify({ changeOrder: { id: 'co-1' }, finalAuthorizedAmountCents: '15000' }),
          requestFingerprint: 'APPROVE:co-1:customer-1:99999:quote-1',
          expiresAt: new Date(Date.now() + 86400000),
        },
      })
      const result = await approveChangeOrder(prisma, 'co-1', 'customer-1', 'idem-key-1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('IDEMPOTENCY_CONFLICT')
    })

    it('commercial approval IdempotencyRecord contains authenticated customerId', async () => {
      let capturedTx: any = null
      const prisma = mockPrisma()
      const origTransaction = prisma.$transaction
      prisma.$transaction = vi.fn().mockImplementation(async (fn: any) => {
        const txMocks = {
          jobChangeOrder: {
            update: vi.fn().mockResolvedValue({ id: 'co-1', status: 'APPROVED', customerDecisionAt: new Date(), approvedByCustomerId: 'customer-1' }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({ id: 'co-1', status: 'APPROVED', amountDeltaCents: 5000n }),
            findMany: vi.fn().mockResolvedValue([{ id: 'co-1', status: 'APPROVED', amountDeltaCents: 5000n }]),
          },
          marketplaceJob: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ id: 'job-1', customerId: 'customer-1', approvedQuoteId: 'quote-1', finalAuthorizedAmountCents: null, countryCode: 'LK', status: 'QUOTE_ACCEPTED' }),
          },
          jobQuote: {
            findUnique: vi.fn().mockResolvedValue({ id: 'quote-1', price: 10000n, totalCents: 10000n, status: 'ACCEPTED' }),
          },
          jobEscrow: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'escrow-1',
              jobId: 'job-1',
              status: 'PENDING_PAYMENT',
              paymentMethod: 'ONLINE',
              currency: 'LKR',
              amount: 10000n,
              serviceFee: 1000n,
              totalAmount: 11000n,
              createdAt: new Date(),
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          paymentIntent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          marketConfig: { findUnique: vi.fn().mockResolvedValue(null) },
          idempotencyRecord: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
          },
        }
        capturedTx = txMocks
        return fn(txMocks)
      })
      const result = await approveChangeOrder(prisma, 'co-1', 'customer-1', 'idem-key-cust')
      expect(result.success).toBe(true)
      expect(capturedTx).not.toBeNull()
      const createCall = capturedTx.idempotencyRecord.create.mock.calls[0]
      expect(createCall[0].data.userId).toBe('customer-1')
      expect(createCall[0].data.userId).not.toBe('')
      expect(createCall[0].data.operation).toBe('APPROVE_CHANGE_ORDER')
    })

    it('requestFingerprint covers operation, resource, customer, amounts', async () => {
      let capturedTx: any = null
      const prisma = mockPrisma()
      prisma.$transaction = vi.fn().mockImplementation(async (fn: any) => {
        const txMocks = {
          jobChangeOrder: {
            update: vi.fn().mockResolvedValue({ id: 'co-1', status: 'APPROVED', customerDecisionAt: new Date(), approvedByCustomerId: 'customer-1' }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUnique: vi.fn().mockResolvedValue({ id: 'co-1', status: 'APPROVED', amountDeltaCents: 5000n }),
            findMany: vi.fn().mockResolvedValue([{ id: 'co-1', status: 'APPROVED', amountDeltaCents: 5000n }]),
          },
          marketplaceJob: {
            update: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue({ id: 'job-1', customerId: 'customer-1', approvedQuoteId: 'quote-1', finalAuthorizedAmountCents: null, countryCode: 'LK', status: 'QUOTE_ACCEPTED' }),
          },
          jobQuote: {
            findUnique: vi.fn().mockResolvedValue({ id: 'quote-1', price: 10000n, totalCents: 10000n, status: 'ACCEPTED' }),
          },
          jobEscrow: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'escrow-1',
              jobId: 'job-1',
              status: 'PENDING_PAYMENT',
              paymentMethod: 'ONLINE',
              currency: 'LKR',
              amount: 10000n,
              serviceFee: 1000n,
              totalAmount: 11000n,
              createdAt: new Date(),
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          paymentIntent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          marketConfig: { findUnique: vi.fn().mockResolvedValue(null) },
          idempotencyRecord: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
          },
        }
        capturedTx = txMocks
        return fn(txMocks)
      })
      const result = await approveChangeOrder(prisma, 'co-1', 'customer-1', 'idem-key-fp')
      expect(result.success).toBe(true)
      const createCall = capturedTx.idempotencyRecord.create.mock.calls[0]
      const fp = createCall[0].data.requestFingerprint
      expect(fp).toContain('APPROVE')
      expect(fp).toContain('co-1')
      expect(fp).toContain('customer-1')
      expect(fp).toContain('5000')
      expect(fp).toContain('quote-1')
    })
  })

  describe('rejectChangeOrder', () => {
    it('rejects a submitted change order', async () => {
      const prisma = mockPrisma()
      const result = await rejectChangeOrder(prisma, 'co-1', 'customer-1')
      expect(result.success).toBe(true)
    })

    it('rejects rejection from non-customer', async () => {
      const prisma = mockPrisma()
      const result = await rejectChangeOrder(prisma, 'co-1', 'wrong-user')
      expect(result.success).toBe(false)
      expect(result.error).toBe('NOT_CUSTOMER')
    })

    it('rejects rejection of non-submitted change order', async () => {
      const prisma = mockPrisma({
        changeOrder: { id: 'co-1', status: 'APPROVED', jobId: 'job-1' },
      })
      const result = await rejectChangeOrder(prisma, 'co-1', 'customer-1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('INVALID_STATUS')
    })
  })

  describe('cancelChangeOrder', () => {
    it('allows creator to cancel', async () => {
      const prisma = mockPrisma()
      const result = await cancelChangeOrder(prisma, 'co-1', 'provider-1')
      expect(result.success).toBe(true)
    })

    it('allows customer to cancel', async () => {
      const prisma = mockPrisma()
      const result = await cancelChangeOrder(prisma, 'co-1', 'customer-1')
      expect(result.success).toBe(true)
    })

    it('rejects cancel from unauthorized user', async () => {
      const prisma = mockPrisma()
      const result = await cancelChangeOrder(prisma, 'co-1', 'random-user')
      expect(result.success).toBe(false)
      expect(result.error).toBe('NOT_AUTHORIZED')
    })

    it('rejects cancel of approved change order', async () => {
      const prisma = mockPrisma({
        changeOrder: { id: 'co-1', status: 'APPROVED', jobId: 'job-1', createdBy: 'provider-1' },
      })
      const result = await cancelChangeOrder(prisma, 'co-1', 'customer-1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('INVALID_STATUS')
    })
  })
})
