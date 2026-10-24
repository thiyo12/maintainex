export interface BenchmarkEvidenceInput {
  countryCode: string
  currency: string
  region?: string | null
  city?: string | null
  sampleSize: number
  medianAmountCents: bigint | number
  lowerPercentileCents: bigint | number
  upperPercentileCents: bigint | number
  minimumObservedCents?: bigint | number | null
  maximumObservedCents?: bigint | number | null
  sourceType: string
  sourceReference?: string | null
  methodologyNote?: string | null
}

/**
 * Machine-verifiable evidence gates. They establish provenance and market
 * consistency, not the truth of an external market-price claim.
 */
export function benchmarkEvidenceErrors(input: BenchmarkEvidenceInput): string[] {
  const errors: string[] = []
  const country = input.countryCode.trim().toUpperCase()
  const currency = input.currency.trim().toUpperCase()
  const sourceType = input.sourceType.trim().toUpperCase()
  const reference = input.sourceReference?.trim() ?? ''
  const methodology = input.methodologyNote?.trim() ?? ''
  const expectedCurrency = country === 'LK' ? 'LKR' : country === 'CA' ? 'CAD' : null

  if (!expectedCurrency || currency !== expectedCurrency) errors.push('currency does not match a supported benchmark market')
  if (country === 'CA' && (input.city?.trim().toLowerCase() !== 'vancouver' ||
      !['british columbia', 'bc'].includes(input.region?.trim().toLowerCase() ?? ''))) {
    errors.push('Canadian benchmarks must be city-scoped to Vancouver, British Columbia')
  }
  if (!Number.isSafeInteger(input.sampleSize) || input.sampleSize < 5) errors.push('at least five observations are required')

  const values = [input.minimumObservedCents, input.lowerPercentileCents,
    input.medianAmountCents, input.upperPercentileCents, input.maximumObservedCents]
    .map(value => value == null ? null : Number(value))
  if (values.some(value => value == null || !Number.isSafeInteger(value) || value <= 0)) {
    errors.push('positive ordered price observations are required')
  } else if (!(values[0]! <= values[1]! && values[1]! <= values[2]! &&
      values[2]! <= values[3]! && values[3]! <= values[4]!)) {
    errors.push('observed minimum, percentiles, median and maximum are inconsistent')
  }
  if (!reference || reference.length > 1000) errors.push('a stable source reference is required')
  if (methodology.length < 40 || methodology.length > 5000) errors.push('a 40–5000 character methodology is required')
  if (sourceType === 'ADMIN_ESTIMATE' || sourceType === 'OTHER') {
    errors.push('administrative estimates and unspecified sources cannot support a published benchmark')
  }
  if (['PUBLIC_PROVIDER_PRICE', 'MANUAL_MARKET_RESEARCH'].includes(sourceType) &&
      !/^https:\/\//i.test(reference)) {
    errors.push('external price research must reference an HTTPS source')
  }
  return errors
}
