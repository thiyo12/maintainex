import type {
  QuoteClassification,
  BenchmarkResolution,
} from './benchmark-types'

/**
 * Classify a quote amount against a published benchmark.
 *
 * Uses IQR-based thresholds:
 *   p25 - 1.5*IQR = VERY_LOW boundary
 *   p25            = BELOW_TYPICAL boundary
 *   p25..p75       = TYPICAL
 *   p75            = ABOVE_TYPICAL boundary
 *   p75 + 1.5*IQR = VERY_HIGH boundary
 *
 * Returns INSUFFICIENT_DATA when no benchmark is available.
 */
export function classifyQuoteAmount(
  amountCents: bigint,
  benchmark: BenchmarkResolution | null,
): QuoteClassification {
  if (!benchmark) return 'INSUFFICIENT_DATA'
  if (benchmark.sampleSize === 0) return 'INSUFFICIENT_DATA'

  const p25 = benchmark.lowerPercentileCents
  const p75 = benchmark.upperPercentileCents
  const median = benchmark.medianAmountCents
  const iqr = p75 - p25

  // If IQR is 0 (all quotes same price), use percentage of median
  if (iqr === 0n) {
    if (amountCents === median) return 'TYPICAL'
    const deviation = amountCents > median
      ? Number(amountCents - median) / Number(median || 1n)
      : Number(median - amountCents) / Number(median || 1n)
    if (deviation < 0.1) return 'TYPICAL'
    if (deviation < 0.3) return amountCents > median ? 'ABOVE_TYPICAL' : 'BELOW_TYPICAL'
    return amountCents > median ? 'VERY_HIGH' : 'VERY_LOW'
  }

  const veryLowThreshold = p25 - BigInt(Math.round(Number(iqr) * 1.5))
  const veryHighThreshold = p75 + BigInt(Math.round(Number(iqr) * 1.5))

  if (amountCents < veryLowThreshold) return 'VERY_LOW'
  if (amountCents < p25) return 'BELOW_TYPICAL'
  if (amountCents <= p75) return 'TYPICAL'
  if (amountCents <= veryHighThreshold) return 'ABOVE_TYPICAL'
  return 'VERY_HIGH'
}

/**
 * Detect outliers in a set of completed job prices using IQR method.
 * Returns IDs of outlier jobs (NOT removed from dataset, just flagged).
 */
export function detectOutliers(
  prices: Array<{ id: string; amountCents: bigint }>,
  iqrMultiplier: number = 1.5,
): string[] {
  if (prices.length < 4) return []

  const sorted = [...prices].sort((a, b) =>
    a.amountCents < b.amountCents ? -1 : a.amountCents > b.amountCents ? 1 : 0,
  )

  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index].amountCents
  const q3 = sorted[q3Index].amountCents
  const iqr = q3 - q1

  const lowerFence = q1 - BigInt(Math.round(Number(iqr) * iqrMultiplier))
  const upperFence = q3 + BigInt(Math.round(Number(iqr) * iqrMultiplier))

  return prices
    .filter(p => p.amountCents < lowerFence || p.amountCents > upperFence)
    .map(p => p.id)
}

/**
 * Calculate statistical benchmark from completed job prices.
 * Excludes outlier jobs from the calculation.
 */
export function calculateStatistics(
  prices: Array<{ id: string; amountCents: bigint }>,
  outlierIds: string[],
  config: { benchmarkPercentileLow: number; benchmarkPercentileHigh: number },
): {
  median: bigint
  p25: bigint
  p75: bigint
  min: bigint
  max: bigint
  sampleSize: number
  outlierCount: number
  outlierIds: string[]
} {
  const filtered = prices.filter(p => !outlierIds.includes(p.id))
  if (filtered.length === 0) {
    return { median: 0n, p25: 0n, p75: 0n, min: 0n, max: 0n, sampleSize: 0, outlierCount: outlierIds.length, outlierIds }
  }

  const sorted = [...filtered].sort((a, b) =>
    a.amountCents < b.amountCents ? -1 : a.amountCents > b.amountCents ? 1 : 0,
  )

  return {
    median: percentile(sorted, 50),
    p25: percentile(sorted, config.benchmarkPercentileLow),
    p75: percentile(sorted, config.benchmarkPercentileHigh),
    min: sorted[0].amountCents,
    max: sorted[sorted.length - 1].amountCents,
    sampleSize: filtered.length,
    outlierCount: outlierIds.length,
    outlierIds,
  }
}

function percentile(
  sorted: Array<{ id: string; amountCents: bigint }>,
  p: number,
): bigint {
  if (sorted.length === 0) return 0n
  if (sorted.length === 1) return sorted[0].amountCents
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower].amountCents
  const weight = index - lower
  const lowerVal = Number(sorted[lower].amountCents)
  const upperVal = Number(sorted[upper].amountCents)
  return BigInt(Math.round(lowerVal + (upperVal - lowerVal) * weight))
}
