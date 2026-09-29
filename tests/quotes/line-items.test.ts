import { describe, it, expect } from 'vitest'
import { validateLineItems, calculateQuoteTotal } from '@/lib/pricing/line-items'
import type { QuoteLineItemInput } from '@/lib/pricing/benchmark-types'

function makeItem(overrides: Partial<QuoteLineItemInput> = {}): QuoteLineItemInput {
  return {
    type: 'LABOUR',
    description: 'Plumbing repair labour',
    quantity: 2,
    unit: 'hour',
    unitAmountCents: 500000n,
    currency: 'LKR',
    sortOrder: 0,
    ...overrides,
  }
}

describe('Phase 10.3 — Line Items', () => {
  describe('validateLineItems', () => {
    it('rejects empty line items', () => {
      const result = validateLineItems([], 'LKR')
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('at least one')
    })

    it('validates correct line items', () => {
      const items = [
        makeItem({ type: 'LABOUR', quantity: 2, unitAmountCents: 500000n }),
        makeItem({ type: 'MATERIALS', quantity: 1, unitAmountCents: 300000n }),
      ]
      const result = validateLineItems(items, 'LKR')
      expect(result.valid).toBe(true)
      expect(result.validatedItems.length).toBe(2)
      expect(result.validatedItems[0].totalAmountCents).toBe(1000000n) // 2 * 500000
      expect(result.validatedItems[1].totalAmountCents).toBe(300000n) // 1 * 300000
    })

    it('rejects currency mismatch', () => {
      const items = [makeItem({ currency: 'CAD' })]
      const result = validateLineItems(items, 'LKR')
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('currency')
    })

    it('rejects negative quantity', () => {
      const items = [makeItem({ quantity: -1 })]
      const result = validateLineItems(items, 'LKR')
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('quantity')
    })

    it('rejects invalid line item type', () => {
      const items = [makeItem({ type: 'INVALID_TYPE' as any })]
      const result = validateLineItems(items, 'LKR')
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('invalid type')
    })

    it('allows multiple TAX line items', () => {
      const items = [
        makeItem({ type: 'TAX', quantity: 1, unitAmountCents: 10000n }),
        makeItem({ type: 'TAX', quantity: 1, unitAmountCents: 5000n }),
      ]
      const result = validateLineItems(items, 'LKR')
      expect(result.valid).toBe(true)
    })

    it('rejects duplicate LABOUR line items', () => {
      const items = [
        makeItem({ type: 'LABOUR', quantity: 1, unitAmountCents: 100n }),
        makeItem({ type: 'LABOUR', quantity: 1, unitAmountCents: 200n }),
      ]
      const result = validateLineItems(items, 'LKR')
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Duplicate')
    })

    it('calculates server-side totals correctly', () => {
      const items = [
        makeItem({ type: 'LABOUR', quantity: 3, unitAmountCents: 100000n }),
      ]
      const result = validateLineItems(items, 'LKR')
      expect(result.validatedItems[0].totalAmountCents).toBe(300000n)
    })
  })

  describe('calculateQuoteTotal', () => {
    it('calculates subtotal and total from line items', () => {
      const items = [
        { totalAmountCents: 1000000n, type: 'LABOUR' as const },
        { totalAmountCents: 300000n, type: 'MATERIALS' as const },
        { totalAmountCents: 130000n, type: 'TAX' as const },
      ]
      const result = calculateQuoteTotal(items, null, null)
      expect(result.serverSubtotalCents).toBe(1300000n)
      expect(result.serverTaxCents).toBe(130000n)
      expect(result.serverTotalCents).toBe(1430000n)
      expect(result.valid).toBe(true)
    })

    it('detects submitted total mismatch', () => {
      const items = [
        { totalAmountCents: 1000000n, type: 'LABOUR' as const },
      ]
      const result = calculateQuoteTotal(items, null, 999999n)
      expect(result.mismatch).toBe(true)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('handles empty items', () => {
      const result = calculateQuoteTotal([], null, null)
      expect(result.serverSubtotalCents).toBe(0n)
      expect(result.serverTaxCents).toBe(0n)
      expect(result.serverTotalCents).toBe(0n)
    })

    it('validates matching submitted totals', () => {
      const items = [
        { totalAmountCents: 500000n, type: 'LABOUR' as const },
        { totalAmountCents: 50000n, type: 'TAX' as const },
      ]
      const result = calculateQuoteTotal(items, 500000n, 550000n)
      expect(result.valid).toBe(true)
      expect(result.mismatch).toBe(false)
    })
  })
})
