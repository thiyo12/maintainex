import { describe, expect, it, vi } from 'vitest'
import { resolveBenchmark } from '@/lib/pricing/benchmark'

const now = new Date('2026-10-22T00:00:00Z')
const params = {
  serviceTemplateId: 'service', countryCode: 'LK', region: 'Western',
  city: 'Negombo', currency: 'LKR', pricingMode: 'SMART_QUOTE' as const, asOf: now,
}
function makeClient(fallbackEnabled: boolean, samples: number[]) {
  const findFirst = vi.fn().mockImplementation(async () => {
    const sampleSize = samples.shift()
    if (sampleSize === undefined) return null
    return {
      id: 'benchmark', serviceTemplateId: 'service', countryCode: 'LK',
      region: null, city: null, currency: 'LKR', pricingMode: 'SMART_QUOTE',
      sampleSize, medianAmountCents: 1500n, lowerPercentileCents: 1200n,
      upperPercentileCents: 1800n, minimumObservedCents: 1000n,
      maximumObservedCents: 1900n, sourceType: 'PARTNER_DATA',
      sourceReference: 'https://market.example/observations/benchmark-2026',
      methodologyNote: 'Collected verified completed job prices and normalized each item to the same service scope.', version: 1,
      effectiveFrom: now, effectiveTo: null,
    }
  })
  const client = {
    marketConfig: { findUnique: vi.fn().mockResolvedValue({
      minBenchmarkSample: 5, benchmarkFallbackEnabled: fallbackEnabled,
    }) },
    priceBenchmark: { findFirst },
  }
  return { client, findFirst }
}
describe('Phase05 reliable local benchmark selection', () => {
  it('returns null when a city benchmark lacks required observations and fallback is disabled', async () => {
    const { client, findFirst } = makeClient(false, [4])
    expect(await resolveBenchmark(client as any, params)).toBeNull()
    expect(findFirst).toHaveBeenCalledTimes(1)
    expect(findFirst.mock.calls[0][0].where.city).toBe('Negombo')
  })
  it('uses a sufficient local province benchmark when fallback is enabled', async () => {
    const { client, findFirst } = makeClient(true, [4, 10])
    const result = await resolveBenchmark(client as any, params)
    expect(result?.geographyLevel).toBe('PROVINCE')
    expect(result?.confidence).toBe('MEDIUM')
    expect(findFirst).toHaveBeenCalledTimes(2)
  })
  it('never returns a low-sample country fallback as reliable', async () => {
    const { client, findFirst } = makeClient(true, [1, 2, 4])
    expect(await resolveBenchmark(client as any, params)).toBeNull()
    expect(findFirst).toHaveBeenCalledTimes(3)
  })
})
