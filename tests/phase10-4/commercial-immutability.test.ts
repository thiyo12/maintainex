import { describe, it, expect, vi } from 'vitest'
import { assertQuoteMutable, assertChangeOrderMutable, assertJobFinanciallyMutable } from '@/lib/domain/commercial-immutability'

function mockPrisma(overrides: Record<string, any> = {}) {
  const hasQuote = 'quote' in overrides
  const hasChangeOrder = 'changeOrder' in overrides
  const hasJob = 'job' in overrides

  return {
    jobQuote: {
      findUnique: vi.fn().mockResolvedValue(hasQuote ? overrides.quote : { status: 'PENDING', parentQuoteId: null }),
    },
    jobChangeOrder: {
      findUnique: vi.fn().mockResolvedValue(hasChangeOrder ? overrides.changeOrder : { status: 'DRAFT' }),
    },
    marketplaceJob: {
      findUnique: vi.fn().mockResolvedValue(hasJob ? overrides.job : { status: 'QUOTE_ACCEPTED' }),
    },
    jobEscrow: {
      findFirst: vi.fn().mockResolvedValue(overrides.escrow ?? null),
    },
  } as any
}

describe('Commercial immutability guards', () => {
  describe('assertQuoteMutable', () => {
    it('allows mutation of PENDING quote', async () => {
      const prisma = mockPrisma()
      const result = await assertQuoteMutable(prisma, 'quote-1')
      expect(result.mutable).toBe(true)
    })

    it('blocks mutation of ACCEPTED quote', async () => {
      const prisma = mockPrisma({ quote: { status: 'ACCEPTED', parentQuoteId: null } })
      const result = await assertQuoteMutable(prisma, 'quote-1')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('QUOTE_ACCEPTED')
    })

    it('blocks mutation of SUPERSEDED quote', async () => {
      const prisma = mockPrisma({ quote: { status: 'SUPERSEDED', parentQuoteId: null } })
      const result = await assertQuoteMutable(prisma, 'quote-1')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('QUOTE_SUPERSEDED')
    })

    it('blocks mutation of revision quote', async () => {
      const prisma = mockPrisma({ quote: { status: 'PENDING', parentQuoteId: 'parent-1' } })
      const result = await assertQuoteMutable(prisma, 'quote-1')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('QUOTE_IS_REVISION')
    })

    it('returns QUOTE_NOT_FOUND for missing quote', async () => {
      const prisma = mockPrisma({ quote: null })
      const result = await assertQuoteMutable(prisma, 'nonexistent')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('QUOTE_NOT_FOUND')
    })
  })

  describe('assertChangeOrderMutable', () => {
    it('allows mutation of DRAFT change order', async () => {
      const prisma = mockPrisma()
      const result = await assertChangeOrderMutable(prisma, 'co-1')
      expect(result.mutable).toBe(true)
    })

    it('allows mutation of SUBMITTED change order', async () => {
      const prisma = mockPrisma({ changeOrder: { status: 'SUBMITTED' } })
      const result = await assertChangeOrderMutable(prisma, 'co-1')
      expect(result.mutable).toBe(true)
    })

    it('blocks mutation of APPROVED change order', async () => {
      const prisma = mockPrisma({ changeOrder: { status: 'APPROVED' } })
      const result = await assertChangeOrderMutable(prisma, 'co-1')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('CHANGE_ORDER_APPROVED')
    })

    it('blocks mutation of REJECTED change order', async () => {
      const prisma = mockPrisma({ changeOrder: { status: 'REJECTED' } })
      const result = await assertChangeOrderMutable(prisma, 'co-1')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('CHANGE_ORDER_REJECTED')
    })

    it('blocks mutation of CANCELLED change order', async () => {
      const prisma = mockPrisma({ changeOrder: { status: 'CANCELLED' } })
      const result = await assertChangeOrderMutable(prisma, 'co-1')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('CHANGE_ORDER_CANCELLED')
    })
  })

  describe('assertJobFinanciallyMutable', () => {
    it('allows mutation of active job', async () => {
      const prisma = mockPrisma()
      const result = await assertJobFinanciallyMutable(prisma, 'job-1')
      expect(result.mutable).toBe(true)
    })

    it('blocks mutation of COMPLETED job', async () => {
      const prisma = mockPrisma({ job: { status: 'COMPLETED' } })
      const result = await assertJobFinanciallyMutable(prisma, 'job-1')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('JOB_COMPLETED')
    })

    it('blocks mutation of CANCELLED job', async () => {
      const prisma = mockPrisma({ job: { status: 'CANCELLED' } })
      const result = await assertJobFinanciallyMutable(prisma, 'job-1')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('JOB_CANCELLED')
    })

    it('blocks mutation when payment settled', async () => {
      const prisma = mockPrisma({ escrow: { id: 'esc-1', status: 'RELEASED' } })
      const result = await assertJobFinanciallyMutable(prisma, 'job-1')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('PAYMENT_SETTLED')
    })

    it('returns JOB_NOT_FOUND for missing job', async () => {
      const prisma = mockPrisma({ job: null })
      const result = await assertJobFinanciallyMutable(prisma, 'nonexistent')
      expect(result.mutable).toBe(false)
      expect(result.reason).toBe('JOB_NOT_FOUND')
    })
  })
})
