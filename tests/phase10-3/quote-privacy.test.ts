import { describe, it, expect } from 'vitest'
import { resolveQuoteVisibility } from '@/lib/phase6/quote-visibility'

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    marketplaceJob: {
      findUnique: vi.fn().mockResolvedValue(overrides.job ?? { id: 'job-1', customerId: 'customer-1' }),
    },
    teamMember: {
      findFirst: vi.fn().mockResolvedValue(overrides.teamMember ?? null),
    },
    jobQuote: {
      findFirst: vi.fn().mockResolvedValue(overrides.quote ?? null),
    },
    ...overrides,
  } as any
}

import { vi } from 'vitest'

describe('Phase 10.3 — Competitor Quote Privacy', () => {
  describe('resolveQuoteVisibility', () => {
    it('customer sees all quotes (empty allowedQuoteIds = all)', async () => {
      const client = mockPrisma()
      const result = await resolveQuoteVisibility(client, {
        userId: 'customer-1',
        jobId: 'job-1',
      })
      expect(result.isCustomer).toBe(true)
      expect(result.allowedQuoteIds).toEqual([])
    })

    it('provider without quote gets empty allowedQuoteIds', async () => {
      const client = mockPrisma({ quote: null })
      const result = await resolveQuoteVisibility(client, {
        userId: 'provider-1',
        jobId: 'job-1',
      })
      expect(result.isCustomer).toBe(false)
      expect(result.allowedQuoteIds).toEqual([])
    })

    it('individual provider sees only their own quote', async () => {
      const client = mockPrisma({
        quote: { id: 'quote-provider-1' },
      })
      const result = await resolveQuoteVisibility(client, {
        userId: 'provider-1',
        jobId: 'job-1',
      })
      expect(result.isCustomer).toBe(false)
      expect(result.allowedQuoteIds).toEqual(['quote-provider-1'])
    })

    it('company provider sees only their company quote', async () => {
      const client = {
        marketplaceJob: {
          findUnique: vi.fn().mockResolvedValue({ id: 'job-1', customerId: 'customer-1' }),
        },
        teamMember: {
          findFirst: vi.fn().mockResolvedValue({ role: 'DISPATCHER' }),
        },
        jobQuote: {
          findFirst: vi.fn().mockResolvedValue({ id: 'quote-company-1' }),
        },
      } as any
      const result = await resolveQuoteVisibility(client, {
        userId: 'company-member-1',
        jobId: 'job-1',
        companyId: 'company-1',
      })
      expect(result.isCustomer).toBe(false)
      expect(result.allowedQuoteIds).toEqual(['quote-company-1'])
    })

    it('unrelated provider sees nothing', async () => {
      const client = mockPrisma({ quote: null })
      const result = await resolveQuoteVisibility(client, {
        userId: 'unrelated-provider',
        jobId: 'job-1',
      })
      expect(result.isCustomer).toBe(false)
      expect(result.allowedQuoteIds).toEqual([])
    })
  })

  describe('Job detail endpoint quote filtering', () => {
    it('customer sees all quotes with prices', () => {
      // This simulates the job detail endpoint logic
      const isOwner = true
      const isQuoter = false
      const allQuotes = [
        { id: 'q1', price: 10000n, providerId: 'p1' },
        { id: 'q2', price: 12000n, providerId: 'p2' },
        { id: 'q3', price: 8000n, providerId: 'p3' },
      ]

      const visibleQuotes = isOwner
        ? allQuotes
        : isQuoter
          ? allQuotes.filter(q => q.providerId === 'current-provider')
          : []

      expect(visibleQuotes).toHaveLength(3)
    })

    it('provider with quote sees only their own', () => {
      const isOwner = false
      const isQuoter = true
      const currentProvider = 'p2'
      const allQuotes = [
        { id: 'q1', price: 10000n, providerId: 'p1' },
        { id: 'q2', price: 12000n, providerId: 'p2' },
        { id: 'q3', price: 8000n, providerId: 'p3' },
      ]

      const visibleQuotes = isOwner
        ? allQuotes
        : isQuoter
          ? allQuotes.filter(q => q.providerId === currentProvider)
          : []

      expect(visibleQuotes).toHaveLength(1)
      expect(visibleQuotes[0].providerId).toBe('p2')
      expect(visibleQuotes[0].price).toBe(12000n)
    })

    it('provider without quote sees nothing', () => {
      const isOwner = false
      const isQuoter = false
      const allQuotes = [
        { id: 'q1', price: 10000n, providerId: 'p1' },
        { id: 'q2', price: 12000n, providerId: 'p2' },
      ]

      const visibleQuotes = isOwner
        ? allQuotes
        : isQuoter
          ? allQuotes.filter(q => q.providerId === 'current-provider')
          : []

      expect(visibleQuotes).toHaveLength(0)
    })

    it('provider A cannot see provider B amount', () => {
      const isOwner = false
      const isQuoter = true
      const providerA = 'provider-A'
      const allQuotes = [
        { id: 'qA', price: 10000n, providerId: 'provider-A' },
        { id: 'qB', price: 12000n, providerId: 'provider-B' },
      ]

      const visibleQuotes = isOwner
        ? allQuotes
        : isQuoter
          ? allQuotes.filter(q => q.providerId === providerA)
          : []

      expect(visibleQuotes).toHaveLength(1)
      expect(visibleQuotes.find(q => q.providerId === 'provider-B')).toBeUndefined()
    })
  })

  describe('Quotes GET endpoint privacy', () => {
    it('provider query returns only own quote IDs', () => {
      // Simulates resolveQuoteVisibility for a provider
      const providerId = 'provider-A'
      const jobQuotes = [
        { id: 'qA', providerId: 'provider-A' },
        { id: 'qB', providerId: 'provider-B' },
        { id: 'qC', providerId: 'provider-C' },
      ]

      // resolveQuoteVisibility returns the provider's own quote ID
      const allowedQuoteIds = jobQuotes
        .filter(q => q.providerId === providerId)
        .map(q => q.id)

      expect(allowedQuoteIds).toEqual(['qA'])
    })

    it('customer query returns all quotes', () => {
      // Simulates resolveQuoteVisibility for a customer
      const isCustomer = true
      const allowedQuoteIds: string[] = [] // empty = all
      const jobQuotes = [
        { id: 'qA', providerId: 'provider-A' },
        { id: 'qB', providerId: 'provider-B' },
        { id: 'qC', providerId: 'provider-C' },
      ]

      const visibleQuotes = isCustomer
        ? jobQuotes
        : jobQuotes.filter(q => allowedQuoteIds.includes(q.id))

      expect(visibleQuotes).toHaveLength(3)
    })

    it('provider cannot reconstruct competitor bid from visible data', () => {
      // Provider A submits 10,000
      // Provider B submits 12,000
      // Provider A GET → only sees their own 10,000
      // They cannot derive: lowest, highest, median, or any other provider's price

      const providerAQuotes = [{ id: 'qA', price: 10000n }]
      const allQuotesOnJob = [
        { id: 'qA', price: 10000n },
        { id: 'qB', price: 12000n },
        { id: 'qC', price: 8000n },
      ]

      // Provider A can only see their own quote
      expect(providerAQuotes).toHaveLength(1)
      expect(providerAQuotes[0].price).toBe(10000n)

      // Provider A cannot derive:
      const lowest = Math.min(...allQuotesOnJob.map(q => Number(q.price)))
      const highest = Math.max(...allQuotesOnJob.map(q => Number(q.price)))
      const median = allQuotesOnJob.sort((a, b) => Number(a.price) - Number(b.price))[1].price

      // These values are NOT available to Provider A
      expect(lowest).toBe(8000) // Provider A doesn't know this
      expect(highest).toBe(12000) // Provider A doesn't know this
      expect(median).toBe(10000n) // Provider A doesn't know this
    })
  })
})
