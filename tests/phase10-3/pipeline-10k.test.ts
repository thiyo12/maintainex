import { describe, it, expect, vi } from 'vitest'
import { classifyQuoteAmount } from '@/lib/pricing/classification'
import { validateLineItems, calculateQuoteTotal } from '@/lib/pricing/line-items'
import type { BenchmarkResolution } from '@/lib/pricing/benchmark-types'
import type { QuoteLineItemInput } from '@/lib/pricing/benchmark-types'

describe('Phase 10.3 — 10K Performance', () => {
  it('classifies 10K quotes in <500ms', () => {
    const bench: BenchmarkResolution = {
      benchmarkId: 'b1', serviceTemplateId: 'st1', countryCode: 'LK',
      region: null, city: null, currency: 'LKR', pricingMode: 'SMART_QUOTE',
      sampleSize: 50, medianAmountCents: 1000000n,
      lowerPercentileCents: 800000n, upperPercentileCents: 1300000n,
      minimumObservedCents: 500000n, maximumObservedCents: 2500000n,
      sourceType: 'MANUAL_MARKET_RESEARCH', sourceReference: null,
      methodologyNote: null, version: 1, effectiveFrom: null, effectiveTo: null,
      geographyLevel: 'COUNTRY', confidence: 'HIGH',
    }

    const start = Date.now()
    for (let i = 0; i < 10000; i++) {
      const amount = BigInt(500000 + (i % 2000) * 100)
      classifyQuoteAmount(amount, bench)
    }
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(500)
  })

  it('classifies 10K quotes without benchmark in <200ms', () => {
    const start = Date.now()
    for (let i = 0; i < 10000; i++) {
      classifyQuoteAmount(BigInt(i * 100), null)
    }
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(200)
  })

  it('validates 1K line item sets in <500ms', () => {
    const items: QuoteLineItemInput[] = [
      { type: 'LABOUR', description: 'Work', quantity: 2, unit: 'hour', unitAmountCents: 500000n, currency: 'LKR' },
      { type: 'MATERIALS', description: 'Parts', quantity: 1, unit: 'item', unitAmountCents: 300000n, currency: 'LKR' },
      { type: 'TAX', description: 'VAT', quantity: 1, unitAmountCents: 130000n, currency: 'LKR' },
    ]

    const start = Date.now()
    for (let i = 0; i < 1000; i++) {
      validateLineItems(items, 'LKR')
    }
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(500)
  })

  it('calculates 10K quote totals in <200ms', () => {
    const items = [
      { totalAmountCents: 1000000n, type: 'LABOUR' as const },
      { totalAmountCents: 300000n, type: 'MATERIALS' as const },
      { totalAmountCents: 130000n, type: 'TAX' as const },
    ]

    const start = Date.now()
    for (let i = 0; i < 10000; i++) {
      calculateQuoteTotal(items, null, null)
    }
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(200)
  })
})
