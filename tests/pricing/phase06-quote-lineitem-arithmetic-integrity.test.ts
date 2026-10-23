import { describe, expect, it } from 'vitest'
import { calculateQuoteTotal, validateLineItems } from '@/lib/pricing/line-items'

describe('Phase 06 quote line-item arithmetic integrity', () => {
  it.each([0, -1, 1.5, Number.NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects malformed quantity %s instead of silently rounding', (quantity) => {
      const result = validateLineItems([{
        type: 'LABOUR', description: 'Service labour', quantity,
        unitAmountCents: 1999n, currency: 'CAD',
      }], 'CAD')
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('positive safe integer')]))
      expect(result.validatedItems).toHaveLength(0)
    },
  )
  it('retains exact integer minor-unit arithmetic through tax and total', () => {
    const result = validateLineItems([
      { type: 'LABOUR', description: 'Labour', quantity: 3, unitAmountCents: 1999n, currency: 'CAD' },
      { type: 'TAX', description: 'Tax', quantity: 1, unitAmountCents: 780n, currency: 'CAD' },
    ], 'CAD')
    expect(result.valid).toBe(true)
    const totals = calculateQuoteTotal(result.validatedItems, 5997n, 6777n)
    expect(totals.valid).toBe(true)
    expect(totals.serverSubtotalCents).toBe(5997n)
    expect(totals.serverTaxCents).toBe(780n)
    expect(totals.serverTotalCents).toBe(6777n)
  })
})
