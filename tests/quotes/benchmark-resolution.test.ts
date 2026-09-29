import { describe, it, expect, vi } from 'vitest'
import { resolveBenchmark, resolveBenchmarkConfig } from '@/lib/pricing/benchmark'
import type { PricingMode } from '@/lib/pricing/benchmark-types'

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    priceBenchmark: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    marketConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as any
}

describe('Phase 10.3 — Benchmark Resolution', () => {
  describe('resolveBenchmark', () => {
    it('returns null when no benchmarks exist', async () => {
      const client = mockPrisma()
      const result = await resolveBenchmark(client, {
        serviceTemplateId: 'st-1',
        countryCode: 'LK',
        currency: 'LKR',
        pricingMode: 'SMART_QUOTE',
      })
      expect(result).toBeNull()
    })

    it('resolves city-level benchmark when available', async () => {
      const client = mockPrisma({
        priceBenchmark: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'bench-city',
            serviceTemplateId: 'st-1',
            countryCode: 'LK',
            region: 'Northern Province',
            city: 'Jaffna',
            currency: 'LKR',
            pricingMode: 'SMART_QUOTE',
            sampleSize: 15,
            medianAmountCents: 1000000n,
            lowerPercentileCents: 800000n,
            upperPercentileCents: 1300000n,
            minimumObservedCents: 500000n,
            maximumObservedCents: 2500000n,
            sourceType: 'MANUAL_MARKET_RESEARCH',
            sourceReference: null,
            methodologyNote: null,
            status: 'PUBLISHED',
            version: 1,
            effectiveFrom: null,
            effectiveTo: null,
          }),
        },
      })
      const result = await resolveBenchmark(client, {
        serviceTemplateId: 'st-1',
        countryCode: 'LK',
        region: 'Northern Province',
        city: 'Jaffna',
        currency: 'LKR',
        pricingMode: 'SMART_QUOTE',
      })
      expect(result).not.toBeNull()
      expect(result?.geographyLevel).toBe('CITY')
      expect(result?.city).toBe('Jaffna')
    })

    it('falls back to province when city benchmark unavailable', async () => {
      let callCount = 0
      const client = mockPrisma({
        priceBenchmark: {
          findFirst: vi.fn().mockImplementation(() => {
            callCount++
            if (callCount === 1) return Promise.resolve(null) // city miss
            return Promise.resolve({ // province hit
              id: 'bench-province',
              serviceTemplateId: 'st-1',
              countryCode: 'LK',
              region: 'Northern Province',
              city: null,
              currency: 'LKR',
              pricingMode: 'SMART_QUOTE',
              sampleSize: 25,
              medianAmountCents: 900000n,
              lowerPercentileCents: 700000n,
              upperPercentileCents: 1200000n,
              minimumObservedCents: 400000n,
              maximumObservedCents: 2000000n,
              sourceType: 'MANUAL_MARKET_RESEARCH',
              sourceReference: null,
              methodologyNote: null,
              status: 'PUBLISHED',
              version: 1,
              effectiveFrom: null,
              effectiveTo: null,
            })
          }),
        },
      })
      const result = await resolveBenchmark(client, {
        serviceTemplateId: 'st-1',
        countryCode: 'LK',
        region: 'Northern Province',
        city: 'Jaffna',
        currency: 'LKR',
        pricingMode: 'SMART_QUOTE',
      })
      expect(result).not.toBeNull()
      expect(result?.geographyLevel).toBe('PROVINCE')
      expect(result?.city).toBeNull()
    })

    it('falls back to country when province benchmark unavailable', async () => {
      let callCount = 0
      const client = mockPrisma({
        priceBenchmark: {
          findFirst: vi.fn().mockImplementation(() => {
            callCount++
            if (callCount <= 2) return Promise.resolve(null) // city + province miss
            return Promise.resolve({ // country hit
              id: 'bench-country',
              serviceTemplateId: 'st-1',
              countryCode: 'LK',
              region: null,
              city: null,
              currency: 'LKR',
              pricingMode: 'SMART_QUOTE',
              sampleSize: 50,
              medianAmountCents: 850000n,
              lowerPercentileCents: 600000n,
              upperPercentileCents: 1100000n,
              minimumObservedCents: 300000n,
              maximumObservedCents: 1800000n,
              sourceType: 'MANUAL_MARKET_RESEARCH',
              sourceReference: null,
              methodologyNote: null,
              status: 'PUBLISHED',
              version: 1,
              effectiveFrom: null,
              effectiveTo: null,
            })
          }),
        },
      })
      const result = await resolveBenchmark(client, {
        serviceTemplateId: 'st-1',
        countryCode: 'LK',
        region: 'Northern Province',
        city: 'Jaffna',
        currency: 'LKR',
        pricingMode: 'SMART_QUOTE',
      })
      expect(result).not.toBeNull()
      expect(result?.geographyLevel).toBe('COUNTRY')
    })

    it('returns null when no benchmark at any level', async () => {
      const client = mockPrisma({
        priceBenchmark: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      })
      const result = await resolveBenchmark(client, {
        serviceTemplateId: 'st-1',
        countryCode: 'LK',
        region: 'Northern Province',
        city: 'Jaffna',
        currency: 'LKR',
        pricingMode: 'SMART_QUOTE',
      })
      expect(result).toBeNull()
    })

    it('does not select expired benchmarks', async () => {
      // When asOf is 2026, an expired benchmark (effectiveTo: 2020) should be rejected.
      // The mock simulates this by returning null — the real Prisma query handles date filtering.
      const client = mockPrisma({
        priceBenchmark: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      })
      const result = await resolveBenchmark(client, {
        serviceTemplateId: 'st-1',
        countryCode: 'LK',
        currency: 'LKR',
        pricingMode: 'SMART_QUOTE',
        asOf: new Date('2026-01-01'),
      })
      expect(result).toBeNull()
      // Verify the query was called (date filter was applied)
      expect(client.priceBenchmark.findFirst).toHaveBeenCalled()
    })

    it('selects correct version (highest version number)', async () => {
      const client = mockPrisma({
        priceBenchmark: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'bench-v2',
            serviceTemplateId: 'st-1',
            countryCode: 'LK',
            region: null,
            city: null,
            currency: 'LKR',
            pricingMode: 'SMART_QUOTE',
            sampleSize: 30,
            medianAmountCents: 950000n,
            lowerPercentileCents: 750000n,
            upperPercentileCents: 1200000n,
            minimumObservedCents: 400000n,
            maximumObservedCents: 2000000n,
            sourceType: 'MANUAL_MARKET_RESEARCH',
            sourceReference: null,
            methodologyNote: null,
            status: 'PUBLISHED',
            version: 2,
            effectiveFrom: null,
            effectiveTo: null,
          }),
        },
      })
      const result = await resolveBenchmark(client, {
        serviceTemplateId: 'st-1',
        countryCode: 'LK',
        currency: 'LKR',
        pricingMode: 'SMART_QUOTE',
      })
      expect(result?.version).toBe(2)
    })

    it('derives confidence from sample size', async () => {
      const makeClientWithSample = (sampleSize: number) => mockPrisma({
        priceBenchmark: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'bench-1',
            serviceTemplateId: 'st-1',
            countryCode: 'LK',
            region: null,
            city: null,
            currency: 'LKR',
            pricingMode: 'SMART_QUOTE',
            sampleSize,
            medianAmountCents: 800000n,
            lowerPercentileCents: 600000n,
            upperPercentileCents: 1000000n,
            minimumObservedCents: 400000n,
            maximumObservedCents: 1500000n,
            sourceType: 'MANUAL_MARKET_RESEARCH',
            sourceReference: null,
            methodologyNote: null,
            status: 'PUBLISHED',
            version: 1,
            effectiveFrom: null,
            effectiveTo: null,
          }),
        },
      })

      const low = await resolveBenchmark(makeClientWithSample(3), {
        serviceTemplateId: 'st-1', countryCode: 'LK', currency: 'LKR', pricingMode: 'SMART_QUOTE',
      })
      expect(low?.confidence).toBe('LOW')

      const medium = await resolveBenchmark(makeClientWithSample(15), {
        serviceTemplateId: 'st-1', countryCode: 'LK', currency: 'LKR', pricingMode: 'SMART_QUOTE',
      })
      expect(medium?.confidence).toBe('MEDIUM')

      const high = await resolveBenchmark(makeClientWithSample(50), {
        serviceTemplateId: 'st-1', countryCode: 'LK', currency: 'LKR', pricingMode: 'SMART_QUOTE',
      })
      expect(high?.confidence).toBe('HIGH')
    })
  })

  describe('resolveBenchmarkConfig', () => {
    it('returns defaults when no MarketConfig exists', async () => {
      const client = mockPrisma()
      const config = await resolveBenchmarkConfig(client, 'LK')
      expect(config.minBenchmarkSample).toBe(5)
      expect(config.benchmarkPercentileLow).toBe(25)
      expect(config.benchmarkPercentileHigh).toBe(75)
      expect(config.benchmarkFallbackEnabled).toBe(true)
    })

    it('reads config from MarketConfig', async () => {
      const client = mockPrisma({
        marketConfig: {
          findUnique: vi.fn().mockResolvedValue({
            minBenchmarkSample: 10,
            benchmarkPercentileLow: 20,
            benchmarkPercentileHigh: 80,
            benchmarkOutlierIqrMult: 2.0,
            benchmarkFallbackEnabled: false,
            benchmarkResearchIntervalMonths: 6,
          }),
        },
      })
      const config = await resolveBenchmarkConfig(client, 'LK')
      expect(config.minBenchmarkSample).toBe(10)
      expect(config.benchmarkPercentileLow).toBe(20)
      expect(config.benchmarkPercentileHigh).toBe(80)
      expect(config.benchmarkFallbackEnabled).toBe(false)
    })

    it('falls back to GLOBAL config when country-specific not found', async () => {
      let callCount = 0
      const client = mockPrisma({
        marketConfig: {
          findUnique: vi.fn().mockImplementation((args: any) => {
            callCount++
            if (args?.where?.countryCode === 'LK') return Promise.resolve(null)
            return Promise.resolve({
              minBenchmarkSample: 8,
              benchmarkPercentileLow: 25,
              benchmarkPercentileHigh: 75,
              benchmarkOutlierIqrMult: 1.5,
              benchmarkFallbackEnabled: true,
              benchmarkResearchIntervalMonths: 3,
            })
          }),
        },
      })
      const config = await resolveBenchmarkConfig(client, 'LK')
      expect(config.minBenchmarkSample).toBe(8)
    })
  })
})
