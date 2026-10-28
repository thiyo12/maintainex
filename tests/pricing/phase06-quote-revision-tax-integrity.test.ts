import { describe, expect, it, vi } from 'vitest'
import { createQuoteRevision } from '@/lib/pricing/quote-revision'

vi.mock('@/lib/domain/provider-availability', () => ({
  lockAndAssertProviderAvailable: vi.fn(async () => {}),
}))

function makeClient() {
  const tx = {
    jobQuote: {
      findUnique: vi.fn(async () => ({
        id: 'original', providerId: 'provider', jobId: 'job',
        providerType: 'INDIVIDUAL', status: 'PENDING', currency: 'CAD',
        revisionNumber: 1, actorUserId: 'actor', actorRole: 'PROVIDER',
        attachments: null, message: null,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async () => ({ id: 'revision' })),
    },
    $queryRaw: vi.fn(async () => [{ id: 'job', status: 'OPEN' }]),
    quoteLineItem: { create: vi.fn(async (_args: any) => ({})) },
  }
  const client = { $transaction: vi.fn(async (fn: any) => fn(tx)) }
  return { client, tx }
}
const lineItems = [
  { type: 'LABOUR' as const, description: 'Labour', quantity: 2,
    unitAmountCents: 1000n, totalAmountCents: 2000n, currency: 'CAD', sortOrder: 0 },
  { type: 'TAX' as const, description: 'Tax', quantity: 1,
    unitAmountCents: 100n, totalAmountCents: 100n, currency: 'CAD', sortOrder: 1 },
]
const request = {
  originalQuoteId: 'original', providerId: 'provider', price: 2100n,
  estimatedCompletionTime: '1 day', revisionReason: 'New terms',
  currency: 'CAD', subtotalCents: 2000n, totalCents: 2100n, taxCents: 100n,
  lineItems,
}

describe('Phase06 quote revision integrity', () => {
  it('rejects incorrect tax before consuming the original quote', async () => {
    const { client, tx } = makeClient()
    const result = await createQuoteRevision(client as any, { ...request, taxCents: 200n })
    expect(result.success).toBe(false)
    expect(tx.jobQuote.updateMany).not.toHaveBeenCalled()
  })

  it('rejects an explicit empty line-item revision before superseding the original', async () => {
    const { client, tx } = makeClient()
    const result = await createQuoteRevision(client as any, { ...request, lineItems: [] })
    expect(result.success).toBe(false)
    expect(tx.jobQuote.updateMany).not.toHaveBeenCalled()
  })

  it.each(['subtotalCents', 'taxCents', 'totalCents'] as const)(
    'rejects an itemized revision missing %s before superseding', async (field) => {
      const { client, tx } = makeClient()
      const result = await createQuoteRevision(client as any, { ...request, [field]: undefined })
      expect(result.success).toBe(false)
      expect(tx.jobQuote.updateMany).not.toHaveBeenCalled()
    },
  )

  it('rejects a revision whose subtotal plus tax disagrees with total', async () => {
    const { client, tx } = makeClient()
    const result = await createQuoteRevision(client as any, { ...request, totalCents: 2200n })
    expect(result.success).toBe(false)
    expect(tx.jobQuote.updateMany).not.toHaveBeenCalled()
  })

  it.each([Number.NaN, Infinity, 1.5])('rejects malformed quantity %s without BigInt exception or quote mutation', async (quantity) => {
    const { client, tx } = makeClient()
    const result = await createQuoteRevision(client as any, {
      ...request, lineItems: [{ ...lineItems[0], quantity }],
    })
    expect(result.success).toBe(false)
    expect(tx.jobQuote.updateMany).not.toHaveBeenCalled()
  })

  it('rejects forged line-item totals before superseding the original', async () => {
    const { client, tx } = makeClient()
    const forged = lineItems.map((item, index) => index === 0
      ? { ...item, totalAmountCents: 999999n } : item)
    const result = await createQuoteRevision(client as any, { ...request, lineItems: forged })
    expect(result.success).toBe(false)
    expect(tx.jobQuote.updateMany).not.toHaveBeenCalled()
  })

  it('persists server-verified line totals', async () => {
    const { client, tx } = makeClient()
    const result = await createQuoteRevision(client as any, request)
    expect(result.success).toBe(true)
    expect(tx.quoteLineItem.create).toHaveBeenCalledTimes(2)
    expect(tx.quoteLineItem.create.mock.calls[0][0].data.totalAmountCents).toBe(2000n)
    expect(tx.quoteLineItem.create.mock.calls[1][0].data.totalAmountCents).toBe(100n)
  })
})
