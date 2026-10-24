import { describe, expect, it } from 'vitest'
import { benchmarkEvidenceErrors } from '@/lib/pricing/benchmark-evidence'

const valid = {
  countryCode: 'CA', currency: 'CAD', region: 'British Columbia', city: 'Vancouver',
  sampleSize: 12, minimumObservedCents: 1000, lowerPercentileCents: 1200,
  medianAmountCents: 1500, upperPercentileCents: 1800, maximumObservedCents: 2000,
  sourceType: 'PUBLIC_PROVIDER_PRICE', sourceReference: 'https://provider.example/pricing',
  methodologyNote: 'Collected twelve public prices for the same service and normalized the quoted unit.',
}

describe('published market benchmark evidence gates', () => {
  it('accepts internally consistent Vancouver CAD evidence with sufficient sample and provenance', () => {
    expect(benchmarkEvidenceErrors(valid)).toEqual([])
  })

  it('rejects Canadian prices without Vancouver locality and currency', () => {
    expect(benchmarkEvidenceErrors({ ...valid, city: 'Toronto' })).toContain(
      'Canadian benchmarks must be city-scoped to Vancouver, British Columbia',
    )
    expect(benchmarkEvidenceErrors({ ...valid, currency: 'LKR' })).toContain(
      'currency does not match a supported benchmark market',
    )
  })

  it('rejects thin, unreferenced, weakly documented and estimate-only evidence', () => {
    const errors = benchmarkEvidenceErrors({
      ...valid, sampleSize: 4, sourceReference: null, methodologyNote: 'estimate', sourceType: 'ADMIN_ESTIMATE',
    })
    expect(errors).toContain('at least five observations are required')
    expect(errors).toContain('a stable source reference is required')
    expect(errors).toContain('a 40–5000 character methodology is required')
    expect(errors).toContain('administrative estimates and unspecified sources cannot support a published benchmark')
  })

  it('rejects out-of-order price observations and non-HTTPS external sources', () => {
    expect(benchmarkEvidenceErrors({ ...valid, upperPercentileCents: 900 })).toContain(
      'observed minimum, percentiles, median and maximum are inconsistent',
    )
    expect(benchmarkEvidenceErrors({ ...valid, sourceReference: 'http://provider.example/pricing' })).toContain(
      'external price research must reference an HTTPS source',
    )
  })
})
