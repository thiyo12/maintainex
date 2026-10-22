import { describe, expect, it, vi } from 'vitest'
import { getQuoteRevisionHistory } from '@/lib/pricing/quote-revision'

const quote = (id: string, parentQuoteId: string | null) => ({
  id, parentQuoteId, revisionNumber: id === 'original' ? 1 : 2,
  status: 'SUPERSEDED', price: 2000n, createdAt: new Date('2026-10-23T00:00:00Z'),
  revisionReason: null,
})

describe('Phase06 quote revision history cycle safety', () => {
  it('terminates parent-link cycles without repeating revisions', async () => {
    const rows = { original: quote('original', 'newer'), newer: quote('newer', 'original') }
    const client = {
      jobQuote: {
        findUnique: vi.fn(async ({ where }: any) => rows[where.id as keyof typeof rows] ?? null),
        findFirst: vi.fn(async ({ where }: any) =>
          Object.values(rows).find(row => row.parentQuoteId === where.parentQuoteId) ?? null),
      },
    }
    const history = await getQuoteRevisionHistory(client as any, 'original')
    expect(history.map(x => x.id)).toEqual(['newer', 'original'])
    expect(client.jobQuote.findUnique).toHaveBeenCalledTimes(5)
    expect(client.jobQuote.findFirst).toHaveBeenCalledTimes(2)
  })
  it('terminates a self-referencing original without looping', async () => {
    const client = {
      jobQuote: {
        findUnique: vi.fn(async () => quote('original', 'original')),
        findFirst: vi.fn(async () => ({ id: 'original' })),
      },
    }
    const history = await getQuoteRevisionHistory(client as any, 'original')
    expect(history).toHaveLength(1)
    expect(client.jobQuote.findFirst).toHaveBeenCalledTimes(1)
  })
})
