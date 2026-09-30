import { describe, it, expect, vi } from 'vitest'
import {
  isValidChangeOrderTransition,
  isChangeOrderTerminal,
  createChangeOrder,
  transitionChangeOrder,
  calculateFinalAuthorizedAmount,
  approveChangeOrder,
} from '@/lib/domain/change-order'

function mockPrisma(overrides: Record<string, any> = {}) {
  const allChangeOrders = overrides.approvedOrders ?? []
  const client: any = {
    marketplaceJob: {
      findUnique: vi.fn().mockResolvedValue(overrides.job ?? {
        id: 'job-1',
        customerId: 'customer-1',
        status: 'IN_PROGRESS',
        approvedQuoteId: 'quote-accepted',
        finalAuthorizedAmountCents: null,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    jobQuote: {
      findUnique: vi.fn().mockResolvedValue(overrides.quote ?? {
        id: 'quote-accepted',
        jobId: 'job-1',
        status: 'ACCEPTED',
        providerId: 'provider-1',
        price: 50000n,
        totalCents: null,
        revisionNumber: 1,
        createdAt: new Date('2026-09-10'),
      }),
      findFirst: vi.fn().mockResolvedValue(overrides.firstQuote ?? {
        id: 'quote-1',
        price: 50000n,
        createdAt: new Date('2026-09-10'),
      }),
    },
    jobChangeOrder: {
      create: vi.fn().mockResolvedValue(overrides.changeOrder ?? { id: 'co-1', revisionNumber: 1 }),
      findFirst: vi.fn().mockResolvedValue(overrides.lastOrder ?? null),
      findUnique: vi.fn().mockResolvedValue(overrides.foundOrder ?? null),
      findMany: vi.fn().mockImplementation((args: any) => {
        if (args?.where?.status) {
          return Promise.resolve(allChangeOrders.filter((o: any) => o.status === args.where.status))
        }
        return Promise.resolve(allChangeOrders)
      }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    jobChangeOrderLineItem: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    idempotencyRecord: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  }
  client.$transaction = vi.fn(async (fn: any) => fn(client))
  return client as any
}

describe('Phase 10.4 — Change Order Lifecycle', () => {
  describe('isValidChangeOrderTransition', () => {
    it('DRAFT → SUBMITTED is valid', () => {
      expect(isValidChangeOrderTransition('DRAFT', 'SUBMITTED')).toBe(true)
    })
    it('DRAFT → CANCELLED is valid', () => {
      expect(isValidChangeOrderTransition('DRAFT', 'CANCELLED')).toBe(true)
    })
    it('SUBMITTED → APPROVED is valid', () => {
      expect(isValidChangeOrderTransition('SUBMITTED', 'APPROVED')).toBe(true)
    })
    it('SUBMITTED → REJECTED is valid', () => {
      expect(isValidChangeOrderTransition('SUBMITTED', 'REJECTED')).toBe(true)
    })
    it('SUBMITTED → CANCELLED is valid', () => {
      expect(isValidChangeOrderTransition('SUBMITTED', 'CANCELLED')).toBe(true)
    })
    it('DRAFT → APPROVED is invalid (skip)', () => {
      expect(isValidChangeOrderTransition('DRAFT', 'APPROVED')).toBe(false)
    })
    it('APPROVED → any is invalid (terminal)', () => {
      expect(isValidChangeOrderTransition('APPROVED', 'REJECTED')).toBe(false)
      expect(isValidChangeOrderTransition('APPROVED', 'CANCELLED')).toBe(false)
    })
    it('REJECTED → any is invalid (terminal)', () => {
      expect(isValidChangeOrderTransition('REJECTED', 'APPROVED')).toBe(false)
    })
    it('CANCELLED → any is invalid (terminal)', () => {
      expect(isValidChangeOrderTransition('CANCELLED', 'SUBMITTED')).toBe(false)
    })
  })

  describe('isChangeOrderTerminal', () => {
    it('APPROVED is terminal', () => {
      expect(isChangeOrderTerminal('APPROVED')).toBe(true)
    })
    it('REJECTED is terminal', () => {
      expect(isChangeOrderTerminal('REJECTED')).toBe(true)
    })
    it('CANCELLED is terminal', () => {
      expect(isChangeOrderTerminal('CANCELLED')).toBe(true)
    })
    it('DRAFT is not terminal', () => {
      expect(isChangeOrderTerminal('DRAFT')).toBe(false)
    })
    it('SUBMITTED is not terminal', () => {
      expect(isChangeOrderTerminal('SUBMITTED')).toBe(false)
    })
  })

  describe('createChangeOrder', () => {
    it('creates change order with valid inputs', async () => {
      const client = mockPrisma()
      const result = await createChangeOrder(client, {
        jobId: 'job-1',
        baseQuoteId: 'quote-accepted',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
        reason: 'Additional plumbing work needed',
        amountDeltaCents: 15000n,
        createdBy: 'provider-1',
      })
      expect(result.success).toBe(true)
      expect(result.changeOrderId).toBe('co-1')
    })

    it('creates change order with line items', async () => {
      const client = mockPrisma()
      const result = await createChangeOrder(client, {
        jobId: 'job-1',
        baseQuoteId: 'quote-accepted',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
        reason: 'Additional work',
        amountDeltaCents: 20000n,
        createdBy: 'provider-1',
        lineItems: [
          {
            type: 'MATERIALS',
            description: 'Pipe fittings',
            quantity: 2,
            unit: 'piece',
            unitAmountCents: 5000n,
            totalAmountCents: 10000n,
          },
          {
            type: 'LABOUR',
            description: 'Additional labour',
            quantity: 1,
            unitAmountCents: 10000n,
            totalAmountCents: 10000n,
          },
        ],
      })
      expect(result.success).toBe(true)
      expect(client.jobChangeOrderLineItem.createMany).toHaveBeenCalled()
    })

    it('rejects if job not found', async () => {
      const client = mockPrisma()
      client.marketplaceJob.findUnique.mockResolvedValue(null)
      const result = await createChangeOrder(client, {
        jobId: 'nonexistent',
        baseQuoteId: 'quote-1',
        providerType: 'INDIVIDUAL',
        reason: 'test',
        amountDeltaCents: 5000n,
        createdBy: 'provider-1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Job not found')
    })

    it('rejects if job is completed', async () => {
      const client = mockPrisma({ job: { id: 'job-1', status: 'COMPLETED', customerId: 'c1' } })
      const result = await createChangeOrder(client, {
        jobId: 'job-1',
        baseQuoteId: 'quote-1',
        providerType: 'INDIVIDUAL',
        reason: 'test',
        amountDeltaCents: 5000n,
        createdBy: 'provider-1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('completed/cancelled')
    })

    it('rejects if base quote not ACCEPTED', async () => {
      const client = mockPrisma({ quote: { id: 'q1', jobId: 'job-1', status: 'PENDING', providerId: 'p1' } })
      const result = await createChangeOrder(client, {
        jobId: 'job-1',
        baseQuoteId: 'q1',
        providerType: 'INDIVIDUAL',
        reason: 'test',
        amountDeltaCents: 5000n,
        createdBy: 'provider-1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('must be ACCEPTED')
    })

    it('rejects if provider does not own base quote', async () => {
      const client = mockPrisma({ quote: { id: 'q1', jobId: 'job-1', status: 'ACCEPTED', providerId: 'other-provider' } })
      const result = await createChangeOrder(client, {
        jobId: 'job-1',
        baseQuoteId: 'q1',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
        reason: 'test',
        amountDeltaCents: 5000n,
        createdBy: 'provider-1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('does not own the base quote')
    })

    it('supports a negative price delta for a scope reduction', async () => {
      const client = mockPrisma()
      const result = await createChangeOrder(client, {
        jobId: 'job-1',
        baseQuoteId: 'quote-accepted',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
        reason: 'Remove one room from the scope',
        scopeDelta: 'Customer removed one room',
        amountDeltaCents: -5000n,
        createdBy: 'provider-1',
      })
      expect(result.success).toBe(true)
      expect(client.jobChangeOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amountDeltaCents: -5000n }),
      })
    })

    it('rejects a zero-effect change order', async () => {
      const client = mockPrisma()
      const result = await createChangeOrder(client, {
        jobId: 'job-1',
        baseQuoteId: 'quote-accepted',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
        reason: 'No actual change',
        amountDeltaCents: 0n,
        createdBy: 'provider-1',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Change order must modify price or scope')
    })

    it('increments revision number', async () => {
      const client = mockPrisma({ lastOrder: { revisionNumber: 3 } })
      const result = await createChangeOrder(client, {
        jobId: 'job-1',
        baseQuoteId: 'quote-accepted',
        providerType: 'INDIVIDUAL',
        taskerId: 'provider-1',
        reason: 'test',
        amountDeltaCents: 5000n,
        createdBy: 'provider-1',
      })
      expect(result.success).toBe(true)
      expect(client.jobChangeOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ revisionNumber: 4 }),
      })
    })
  })

  describe('transitionChangeOrder', () => {
    it('submits change order', async () => {
      const client = mockPrisma({
        foundOrder: { id: 'co-1', status: 'DRAFT', createdBy: 'provider-1', jobId: 'job-1' },
      })
      const result = await transitionChangeOrder(client, {
        changeOrderId: 'co-1',
        userId: 'provider-1',
        toStatus: 'SUBMITTED',
      })
      expect(result.success).toBe(true)
    })

    it('rejects submit from non-creator', async () => {
      const client = mockPrisma({
        foundOrder: { id: 'co-1', status: 'DRAFT', createdBy: 'provider-1', jobId: 'job-1' },
      })
      const result = await transitionChangeOrder(client, {
        changeOrderId: 'co-1',
        userId: 'wrong-provider',
        toStatus: 'SUBMITTED',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Only the creator can submit')
    })

    it('customer can approve', async () => {
      const client = mockPrisma({
        foundOrder: { id: 'co-1', status: 'SUBMITTED', createdBy: 'provider-1', jobId: 'job-1' },
      })
      const result = await transitionChangeOrder(client, {
        changeOrderId: 'co-1',
        userId: 'customer-1',
        toStatus: 'APPROVED',
      })
      expect(result.success).toBe(true)
    })

    it('rejects approval from non-customer', async () => {
      const client = mockPrisma({
        foundOrder: { id: 'co-1', status: 'SUBMITTED', createdBy: 'provider-1', jobId: 'job-1' },
        job: { id: 'job-1', customerId: 'customer-1' },
      })
      const result = await transitionChangeOrder(client, {
        changeOrderId: 'co-1',
        userId: 'provider-1',
        toStatus: 'APPROVED',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Only the customer can approve/reject')
    })

    it('customer can reject', async () => {
      const client = mockPrisma({
        foundOrder: { id: 'co-1', status: 'SUBMITTED', createdBy: 'provider-1', jobId: 'job-1' },
      })
      const result = await transitionChangeOrder(client, {
        changeOrderId: 'co-1',
        userId: 'customer-1',
        toStatus: 'REJECTED',
        rejectionReason: 'Too expensive',
      })
      expect(result.success).toBe(true)
      expect(client.jobChangeOrder.update).toHaveBeenCalledWith({
        where: { id: 'co-1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'Too expensive',
        }),
      })
    })

    it('provider can cancel own DRAFT', async () => {
      const client = mockPrisma({
        foundOrder: { id: 'co-1', status: 'DRAFT', createdBy: 'provider-1', jobId: 'job-1' },
      })
      const result = await transitionChangeOrder(client, {
        changeOrderId: 'co-1',
        userId: 'provider-1',
        toStatus: 'CANCELLED',
      })
      expect(result.success).toBe(true)
    })

    it('rejects from terminal status', async () => {
      const client = mockPrisma({
        foundOrder: { id: 'co-1', status: 'APPROVED', createdBy: 'provider-1', jobId: 'job-1' },
      })
      const result = await transitionChangeOrder(client, {
        changeOrderId: 'co-1',
        userId: 'provider-1',
        toStatus: 'REJECTED',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('terminal status')
    })
  })

  describe('approveChangeOrder', () => {
    function approvalClient(overrides: Record<string, any> = {}) {
      const client = mockPrisma({
        foundOrder: {
          id: 'co-1',
          status: 'APPROVED',
          createdBy: 'provider-1',
          jobId: 'job-1',
          amountDeltaCents: overrides.delta ?? 5000n,
          baseQuoteId: 'quote-accepted',
        },
        approvedOrders: overrides.approvedOrders ?? [
          { id: 'co-1', status: 'APPROVED', amountDeltaCents: overrides.delta ?? 5000n },
        ],
      })
      client.jobChangeOrder.findUnique
        .mockResolvedValueOnce({
          id: 'co-1',
          status: 'SUBMITTED',
          jobId: 'job-1',
          amountDeltaCents: overrides.delta ?? 5000n,
          baseQuoteId: 'quote-accepted',
          job: { customerId: 'customer-1', finalAuthorizedAmountCents: 50000n },
        })
        .mockResolvedValue({
          id: 'co-1',
          status: 'APPROVED',
          jobId: 'job-1',
          amountDeltaCents: overrides.delta ?? 5000n,
          baseQuoteId: 'quote-accepted',
        })
      if (overrides.transitionCount !== undefined) {
        client.jobChangeOrder.updateMany.mockResolvedValue({ count: overrides.transitionCount })
      }
      return client
    }

    it('approves once and recalculates the final authorized amount', async () => {
      const client = approvalClient()
      const result = await approveChangeOrder(client, 'co-1', 'customer-1')
      expect(result.success).toBe(true)
      expect(result.finalAuthorizedAmountCents).toBe(55000n)
      expect(client.jobChangeOrder.updateMany).toHaveBeenCalledWith({
        where: { id: 'co-1', status: 'SUBMITTED' },
        data: expect.objectContaining({ status: 'APPROVED' }),
      })
    })

    it('rejects a concurrent second approval', async () => {
      const client = approvalClient({ transitionCount: 0 })
      const result = await approveChangeOrder(client, 'co-1', 'customer-1')
      expect(result).toEqual({ success: false, error: 'CONCURRENT_APPROVAL' })
    })

    it('rolls back an approval that would make the final authorized amount non-positive', async () => {
      const client = approvalClient({
        delta: -50000n,
        approvedOrders: [{ id: 'co-1', status: 'APPROVED', amountDeltaCents: -50000n }],
      })
      const result = await approveChangeOrder(client, 'co-1', 'customer-1')
      expect(result).toEqual({
        success: false,
        error: 'FINAL_AUTHORIZED_AMOUNT_MUST_BE_POSITIVE',
      })
    })
  })

  describe('calculateFinalAuthorizedAmount', () => {
    it('calculates base + approved change orders', async () => {
      const client = mockPrisma({
        approvedOrders: [
          { amountDeltaCents: 15000n, status: 'APPROVED' },
          { amountDeltaCents: 5000n, status: 'APPROVED' },
        ],
      })
      const result = await calculateFinalAuthorizedAmount(client, 'job-1')
      expect(result.success).toBe(true)
      expect(result.baseAmountCents).toBe(50000n)
      expect(result.changeOrderDeltaCents).toBe(20000n)
      expect(result.finalAmountCents).toBe(70000n)
    })

    it('uses totalCents from the accepted quote when itemized pricing is present', async () => {
      const client = mockPrisma({
        quote: {
          id: 'quote-accepted',
          jobId: 'job-1',
          status: 'ACCEPTED',
          providerId: 'provider-1',
          price: 50000n,
          totalCents: 57500n,
          revisionNumber: 1,
          createdAt: new Date('2026-09-10'),
        },
        approvedOrders: [],
      })
      const result = await calculateFinalAuthorizedAmount(client, 'job-1')
      expect(result.success).toBe(true)
      expect(result.baseAmountCents).toBe(57500n)
      expect(result.finalAmountCents).toBe(57500n)
    })

    it('excludes non-approved change orders', async () => {
      const client = mockPrisma({
        approvedOrders: [
          { amountDeltaCents: 15000n, status: 'APPROVED' },
          { amountDeltaCents: 10000n, status: 'SUBMITTED' },
          { amountDeltaCents: 5000n, status: 'REJECTED' },
        ],
      })
      const result = await calculateFinalAuthorizedAmount(client, 'job-1')
      expect(result.success).toBe(true)
      expect(result.changeOrderDeltaCents).toBe(15000n)
      expect(result.finalAmountCents).toBe(65000n)
    })

    it('supports approved price reductions while keeping a positive final amount', async () => {
      const client = mockPrisma({
        approvedOrders: [
          { amountDeltaCents: -10000n, status: 'APPROVED' },
          { amountDeltaCents: 5000n, status: 'APPROVED' },
        ],
      })
      const result = await calculateFinalAuthorizedAmount(client, 'job-1')
      expect(result.success).toBe(true)
      expect(result.changeOrderDeltaCents).toBe(-5000n)
      expect(result.finalAmountCents).toBe(45000n)
    })

    it('returns error if no approved quote', async () => {
      const client = mockPrisma({
        job: { id: 'job-1', approvedQuoteId: null, customerId: 'c1' },
      })
      const result = await calculateFinalAuthorizedAmount(client, 'job-1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Job has no approved quote')
    })

    it('returns zero delta if no change orders', async () => {
      const client = mockPrisma({ approvedOrders: [] })
      const result = await calculateFinalAuthorizedAmount(client, 'job-1')
      expect(result.success).toBe(true)
      expect(result.changeOrderDeltaCents).toBe(0n)
      expect(result.finalAmountCents).toBe(50000n)
    })
  })
})
