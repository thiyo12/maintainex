import { describe, it, expect, vi } from 'vitest'
import { createQuoteRevision, getQuoteRevisionHistory, isLatestRevision } from '@/lib/pricing/quote-revision'

function mockPrisma(overrides: Record<string, any> = {}) {
  const store = new Map<string, any>()
  const quoteStore = new Map<string, any>()

  // Seed with original quote if provided
  if (overrides.originalQuote) {
    quoteStore.set(overrides.originalQuote.id, { ...overrides.originalQuote })
  }

  const prisma: any = {
    jobQuote: {
      findUnique: vi.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(quoteStore.get(where.id) ?? overrides.findUnique ?? null)
      }),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const id = `quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const quote = { ...data, id }
        quoteStore.set(id, quote)
        return Promise.resolve(quote)
      }),
      update: vi.fn().mockImplementation(({ where, data }: any) => {
        const existing = quoteStore.get(where.id)
        if (existing) {
          Object.assign(existing, data)
          return Promise.resolve(existing)
        }
        return Promise.resolve({ ...data, id: where.id })
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }: any) => {
        const existing = quoteStore.get(where.id)
        if (!existing) return Promise.resolve({ count: 0 })
        if (where.providerId && existing.providerId !== where.providerId) return Promise.resolve({ count: 0 })
        if (where.status && existing.status !== where.status) return Promise.resolve({ count: 0 })
        Object.assign(existing, data)
        return Promise.resolve({ count: 1 })
      }),
      findFirst: vi.fn().mockResolvedValue(overrides.firstChild ?? null),
    },
    _quoteStore: quoteStore,
  }
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma))
  return prisma as any
}

describe('Phase 10.3 — Quote Revision Lifecycle', () => {
  describe('createQuoteRevision', () => {
    it('creates new DB record with correct parent linkage', async () => {
      const prisma = mockPrisma({
        originalQuote: {
          id: 'orig-1',
          jobId: 'job-1',
          providerId: 'provider-1',
          providerType: 'INDIVIDUAL',
          status: 'PENDING',
          price: 10000n,
          currency: 'LKR',
          revisionNumber: 1,
          parentQuoteId: null,
          estimatedCompletionTime: '2 hours',
          message: 'Original quote',
          attachments: '[]',
        },
      })

      const result = await createQuoteRevision(prisma, {
        originalQuoteId: 'orig-1',
        providerId: 'provider-1',
        price: 12000n,
        estimatedCompletionTime: '3 hours',
        revisionReason: 'Scope change',
      })

      expect(result.success).toBe(true)
      expect(result.newQuoteId).toBeDefined()

      // Verify original was superseded
      const originalUpdate = prisma.jobQuote.updateMany.mock.calls.find(
        (call: any) => call[0].where.id === 'orig-1'
      )
      expect(originalUpdate).toBeDefined()
      expect(originalUpdate![0].data.status).toBe('SUPERSEDED')

      // Verify new quote was created
      const createCall = prisma.jobQuote.create.mock.calls[0]
      expect(createCall[0].data.jobId).toBe('job-1')
      expect(createCall[0].data.providerId).toBe('provider-1')
      expect(createCall[0].data.price).toBe(12000n)
      expect(createCall[0].data.status).toBe('PENDING')
      expect(createCall[0].data.parentQuoteId).toBe('orig-1')
      expect(createCall[0].data.revisionNumber).toBe(2)
      expect(createCall[0].data.revisionReason).toBe('Scope change')
    })

    it('original amount unchanged after revision', async () => {
      const prisma = mockPrisma({
        originalQuote: {
          id: 'orig-1', jobId: 'job-1', providerId: 'provider-1',
          status: 'PENDING', price: 10000n, currency: 'LKR',
          revisionNumber: 1, parentQuoteId: null,
          estimatedCompletionTime: '2h', message: null, attachments: '[]',
        },
      })

      await createQuoteRevision(prisma, {
        originalQuoteId: 'orig-1',
        providerId: 'provider-1',
        price: 15000n,
        estimatedCompletionTime: '4h',
        revisionReason: 'Changed scope',
      })

      // Original quote's price should NOT be modified
      const updateCall = prisma.jobQuote.updateMany.mock.calls.find(
        (call: any) => call[0].where.id === 'orig-1'
      )
      expect(updateCall![0].data).not.toHaveProperty('price')
      expect(updateCall![0].data.status).toBe('SUPERSEDED')
    })

    it('revisionNumber increments correctly', async () => {
      const prisma = mockPrisma({
        originalQuote: {
          id: 'orig-1', jobId: 'job-1', providerId: 'provider-1',
          status: 'PENDING', price: 10000n, currency: 'LKR',
          revisionNumber: 3, parentQuoteId: 'orig-0',
          estimatedCompletionTime: '2h', message: null, attachments: '[]',
        },
      })

      const result = await createQuoteRevision(prisma, {
        originalQuoteId: 'orig-1',
        providerId: 'provider-1',
        price: 11000n,
        estimatedCompletionTime: '2h',
        revisionReason: 'Minor adjustment',
      })

      const createCall = prisma.jobQuote.create.mock.calls[0]
      expect(createCall[0].data.revisionNumber).toBe(4)
    })

    it('provider cannot revise another provider\'s quote', async () => {
      const prisma = mockPrisma({
        originalQuote: {
          id: 'orig-1', jobId: 'job-1', providerId: 'provider-1',
          status: 'PENDING', price: 10000n, currency: 'LKR',
          revisionNumber: 1, parentQuoteId: null,
          estimatedCompletionTime: '2h', message: null, attachments: '[]',
        },
      })

      const result = await createQuoteRevision(prisma, {
        originalQuoteId: 'orig-1',
        providerId: 'provider-2', // different provider
        price: 11000n,
        estimatedCompletionTime: '2h',
        revisionReason: 'Hack',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not your quote')
    })

    it('cannot revise ACCEPTED quote', async () => {
      const prisma = mockPrisma({
        originalQuote: {
          id: 'orig-1', jobId: 'job-1', providerId: 'provider-1',
          status: 'ACCEPTED', price: 10000n, currency: 'LKR',
          revisionNumber: 1, parentQuoteId: null,
          estimatedCompletionTime: '2h', message: null, attachments: '[]',
        },
      })

      const result = await createQuoteRevision(prisma, {
        originalQuoteId: 'orig-1',
        providerId: 'provider-1',
        price: 11000n,
        estimatedCompletionTime: '2h',
        revisionReason: 'Try to change',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot revise an accepted quote')
    })

    it('cannot revise REJECTED quote', async () => {
      const prisma = mockPrisma({
        originalQuote: {
          id: 'orig-1', jobId: 'job-1', providerId: 'provider-1',
          status: 'REJECTED', price: 10000n, currency: 'LKR',
          revisionNumber: 1, parentQuoteId: null,
          estimatedCompletionTime: '2h', message: null, attachments: '[]',
        },
      })

      const result = await createQuoteRevision(prisma, {
        originalQuoteId: 'orig-1',
        providerId: 'provider-1',
        price: 11000n,
        estimatedCompletionTime: '2h',
        revisionReason: 'Revive',
      })

      expect(result.success).toBe(false)
    })

    it('cannot revise SUPERSEDED quote', async () => {
      const prisma = mockPrisma({
        originalQuote: {
          id: 'orig-1', jobId: 'job-1', providerId: 'provider-1',
          status: 'SUPERSEDED', price: 10000n, currency: 'LKR',
          revisionNumber: 1, parentQuoteId: null,
          estimatedCompletionTime: '2h', message: null, attachments: '[]',
        },
      })

      const result = await createQuoteRevision(prisma, {
        originalQuoteId: 'orig-1',
        providerId: 'provider-1',
        price: 11000n,
        estimatedCompletionTime: '2h',
        revisionReason: 'Revive',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('getQuoteRevisionHistory', () => {
    it('returns correct revision chain', async () => {
      const quotes = new Map([
        ['q1', { id: 'q1', revisionNumber: 1, status: 'SUPERSEDED', price: 10000n, createdAt: new Date('2026-01-01'), revisionReason: null, parentQuoteId: null }],
        ['q2', { id: 'q2', revisionNumber: 2, status: 'SUPERSEDED', price: 12000n, createdAt: new Date('2026-01-02'), revisionReason: 'Scope change', parentQuoteId: 'q1' }],
        ['q3', { id: 'q3', revisionNumber: 3, status: 'PENDING', price: 11000n, createdAt: new Date('2026-01-03'), revisionReason: 'Price adjustment', parentQuoteId: 'q2' }],
      ])

      const prisma = {
        jobQuote: {
          findUnique: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(quotes.get(where.id) ?? null)),
          findFirst: vi.fn().mockImplementation(({ where }: any) => {
            for (const [id, q] of quotes) {
              if (q.parentQuoteId === where.parentQuoteId) return Promise.resolve(q)
            }
            return Promise.resolve(null)
          }),
        },
      } as any

      const history = await getQuoteRevisionHistory(prisma, 'q3')
      expect(history).toHaveLength(3)
      expect(history[0].id).toBe('q1')
      expect(history[0].revisionNumber).toBe(1)
      expect(history[1].id).toBe('q2')
      expect(history[1].revisionNumber).toBe(2)
      expect(history[2].id).toBe('q3')
      expect(history[2].revisionNumber).toBe(3)
    })
  })

  describe('isLatestRevision', () => {
    it('returns true for latest revision', async () => {
      const prisma = {
        jobQuote: {
          findUnique: vi.fn().mockResolvedValue({ id: 'q3' }),
          findFirst: vi.fn().mockResolvedValue(null), // no child
        },
      } as any

      const result = await isLatestRevision(prisma, 'q3')
      expect(result).toBe(true)
    })

    it('returns false for non-latest revision', async () => {
      const prisma = {
        jobQuote: {
          findUnique: vi.fn().mockResolvedValue({ id: 'q1' }),
          findFirst: vi.fn().mockResolvedValue({ id: 'q2' }), // has child
        },
      } as any

      const result = await isLatestRevision(prisma, 'q1')
      expect(result).toBe(false)
    })
  })
})
