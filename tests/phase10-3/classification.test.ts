import { describe, it, expect, vi } from 'vitest'
import { classifyQuoteAmount, detectOutliers, calculateStatistics } from '@/lib/pricing/classification'
import type { BenchmarkResolution } from '@/lib/pricing/benchmark-types'

function makeBenchmark(overrides: Partial<BenchmarkResolution> = {}): BenchmarkResolution {
  return {
    benchmarkId: 'bench-1',
    serviceTemplateId: 'st-1',
    countryCode: 'LK',
    region: 'Northern Province',
    city: 'Jaffna',
    currency: 'LKR',
    pricingMode: 'SMART_QUOTE',
    sampleSize: 20,
    medianAmountCents: 1000000n, // LKR 10,000
    lowerPercentileCents: 800000n, // LKR 8,000
    upperPercentileCents: 1300000n, // LKR 13,000
    minimumObservedCents: 500000n,
    maximumObservedCents: 2500000n,
    sourceType: 'MANUAL_MARKET_RESEARCH',
    sourceReference: null,
    methodologyNote: null,
    version: 1,
    effectiveFrom: null,
    effectiveTo: null,
    geographyLevel: 'CITY',
    confidence: 'MEDIUM',
    ...overrides,
  }
}

describe('Phase 10.3 — Quote Classification', () => {
  describe('classifyQuoteAmount', () => {
    it('returns INSUFFICIENT_DATA when no benchmark', () => {
      expect(classifyQuoteAmount(1000000n, null)).toBe('INSUFFICIENT_DATA')
    })

    it('returns INSUFFICIENT_DATA when sampleSize is 0', () => {
      const bench = makeBenchmark({ sampleSize: 0 })
      expect(classifyQuoteAmount(1000000n, bench)).toBe('INSUFFICIENT_DATA')
    })

    it('classifies TYPICAL when within P25-P75 range', () => {
      const bench = makeBenchmark()
      expect(classifyQuoteAmount(1000000n, bench)).toBe('TYPICAL') // exact median
      expect(classifyQuoteAmount(900000n, bench)).toBe('TYPICAL') // between P25 and median
      expect(classifyQuoteAmount(1100000n, bench)).toBe('TYPICAL') // between median and P75
      expect(classifyQuoteAmount(800000n, bench)).toBe('TYPICAL') // exact P25
      expect(classifyQuoteAmount(1300000n, bench)).toBe('TYPICAL') // exact P75
    })

    it('classifies BELOW_TYPICAL when below P25', () => {
      const bench = makeBenchmark()
      expect(classifyQuoteAmount(700000n, bench)).toBe('BELOW_TYPICAL')
    })

    it('classifies ABOVE_TYPICAL when above P75', () => {
      const bench = makeBenchmark()
      expect(classifyQuoteAmount(1500000n, bench)).toBe('ABOVE_TYPICAL')
    })

    it('classifies VERY_LOW when far below P25 (IQR boundary)', () => {
      // IQR = 1300000 - 800000 = 500000
      // Very low boundary = 800000 - 1.5*500000 = 50000
      const bench = makeBenchmark()
      expect(classifyQuoteAmount(40000n, bench)).toBe('VERY_LOW')
    })

    it('classifies VERY_HIGH when far above P75 (IQR boundary)', () => {
      // IQR = 500000
      // Very high boundary = 1300000 + 1.5*500000 = 2050000
      const bench = makeBenchmark()
      expect(classifyQuoteAmount(2100000n, bench)).toBe('VERY_HIGH')
    })

    it('handles zero IQR gracefully', () => {
      const bench = makeBenchmark({
        lowerPercentileCents: 1000000n,
        upperPercentileCents: 1000000n,
        medianAmountCents: 1000000n,
      })
      expect(classifyQuoteAmount(1000000n, bench)).toBe('TYPICAL')
      expect(classifyQuoteAmount(1100000n, bench)).toBe('ABOVE_TYPICAL')
      expect(classifyQuoteAmount(900000n, bench)).toBe('BELOW_TYPICAL')
    })

    it('handles zero median gracefully', () => {
      const bench = makeBenchmark({
        lowerPercentileCents: 0n,
        upperPercentileCents: 0n,
        medianAmountCents: 0n,
      })
      expect(classifyQuoteAmount(0n, bench)).toBe('TYPICAL')
    })
  })

  describe('detectOutliers', () => {
    it('returns empty for fewer than 4 prices', () => {
      const prices = [
        { id: '1', amountCents: 100n },
        { id: '2', amountCents: 200n },
        { id: '3', amountCents: 300n },
      ]
      expect(detectOutliers(prices)).toEqual([])
    })

    it('detects high outliers', () => {
      const prices = [
        { id: '1', amountCents: 100n },
        { id: '2', amountCents: 110n },
        { id: '3', amountCents: 120n },
        { id: '4', amountCents: 130n },
        { id: '5', amountCents: 1000n }, // outlier
      ]
      const outliers = detectOutliers(prices)
      expect(outliers).toContain('5')
    })

    it('detects low outliers', () => {
      const prices = [
        { id: '1', amountCents: 10n }, // outlier
        { id: '2', amountCents: 100n },
        { id: '3', amountCents: 110n },
        { id: '4', amountCents: 120n },
        { id: '5', amountCents: 130n },
      ]
      const outliers = detectOutliers(prices)
      expect(outliers).toContain('1')
    })

    it('returns empty when no outliers', () => {
      const prices = [
        { id: '1', amountCents: 100n },
        { id: '2', amountCents: 105n },
        { id: '3', amountCents: 110n },
        { id: '4', amountCents: 115n },
        { id: '5', amountCents: 120n },
      ]
      expect(detectOutliers(prices)).toEqual([])
    })
  })

  describe('calculateStatistics', () => {
    it('calculates correct percentiles', () => {
      const prices = Array.from({ length: 20 }, (_, i) => ({
        id: `q-${i}`,
        amountCents: BigInt((i + 1) * 100),
      }))
      const stats = calculateStatistics(prices, [], { benchmarkPercentileLow: 25, benchmarkPercentileHigh: 75 })
      expect(stats.sampleSize).toBe(20)
      expect(stats.min).toBe(100n)
      expect(stats.max).toBe(2000n)
      expect(stats.median).toBeGreaterThan(0n)
      expect(stats.p25).toBeLessThanOrEqual(stats.median)
      expect(stats.p75).toBeGreaterThanOrEqual(stats.median)
    })

    it('excludes outliers from calculation', () => {
      const prices = [
        { id: '1', amountCents: 100n },
        { id: '2', amountCents: 110n },
        { id: '3', amountCents: 120n },
        { id: '4', amountCents: 130n },
        { id: '5', amountCents: 10000n },
      ]
      const stats = calculateStatistics(prices, ['5'], { benchmarkPercentileLow: 25, benchmarkPercentileHigh: 75 })
      expect(stats.sampleSize).toBe(4)
      expect(stats.outlierCount).toBe(1)
      expect(stats.outlierIds).toContain('5')
    })

    it('returns zeros for empty input', () => {
      const stats = calculateStatistics([], [], { benchmarkPercentileLow: 25, benchmarkPercentileHigh: 75 })
      expect(stats.sampleSize).toBe(0)
      expect(stats.median).toBe(0n)
    })
  })
})
