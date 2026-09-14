import { PrismaClient } from '@prisma/client'
import type {
  BenchmarkLearnInput,
  StatisticalResult,
  BenchmarkResolution,
} from './benchmark-types'
import { detectOutliers, calculateStatistics } from './classification'
import type { BenchmarkConfig } from './benchmark-types'

/**
 * Learn a benchmark from completed job data.
 * Calculates statistical percentiles from actual completed job prices.
 * Does NOT publish — returns a draft benchmark for review.
 */
export async function learnBenchmarkFromJobs(
  client: PrismaClient,
  input: BenchmarkLearnInput,
  config: BenchmarkConfig,
): Promise<{
  benchmarkId: string | null
  stats: StatisticalResult
  sufficientData: boolean
}> {
  // Fetch completed job quotes matching the service/region
  const quotes = await fetchCompletedQuotes(client, input)

  if (quotes.length === 0) {
    return {
      benchmarkId: null,
      stats: { median: 0n, p25: 0n, p75: 0n, min: 0n, max: 0n, sampleSize: 0, outlierCount: 0, outlierIds: [] },
      sufficientData: false,
    }
  }

  // Detect outliers
  const outlierIds = detectOutliers(quotes, config.benchmarkOutlierIqrMult)

  // Calculate statistics
  const stats = calculateStatistics(quotes, outlierIds, {
    benchmarkPercentileLow: config.benchmarkPercentileLow,
    benchmarkPercentileHigh: config.benchmarkPercentileHigh,
  })

  const sufficientData = stats.sampleSize >= config.minBenchmarkSample

  if (!sufficientData) {
    return { benchmarkId: null, stats, sufficientData }
  }

  // Create draft benchmark
  const benchmark = await client.priceBenchmark.create({
    data: {
      serviceTemplateId: input.serviceTemplateId,
      countryCode: input.countryCode,
      region: input.region ?? null,
      city: input.city ?? null,
      currency: input.currency,
      pricingMode: input.pricingMode,
      sampleSize: stats.sampleSize,
      medianAmountCents: stats.median,
      lowerPercentileCents: stats.p25,
      upperPercentileCents: stats.p75,
      minimumObservedCents: stats.min,
      maximumObservedCents: stats.max,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference ?? null,
      methodologyNote: input.methodologyNote ?? `Automated from ${stats.sampleSize} completed jobs. ${outlierIds.length} outliers excluded from calculation.`,
      status: 'DRAFT',
      version: 1,
      createdBy: input.createdBy ?? null,
    },
  })

  return { benchmarkId: benchmark.id, stats, sufficientData }
}

/**
 * Fetch completed, accepted quotes for benchmark learning.
 * Safety filters:
 *  - Only COMPLETED jobs with ACCEPTED quotes (not pending, cancelled, etc.)
 *  - Exclude jobs with active disputes (OPEN or UNDER_REVIEW) — disputed
 *    prices may not reflect fair market value and could skew benchmarks.
 *  - Use finalAuthorizedAmountCents (change order total) when available,
 *    falling back to the original quote price. This ensures benchmarks
 *    reflect what was actually paid, not just the initial quote.
 */
async function fetchCompletedQuotes(
  client: PrismaClient,
  input: BenchmarkLearnInput,
): Promise<Array<{ id: string; amountCents: bigint }>> {
  const serviceTemplate = await client.serviceTemplate.findUnique({
    where: { id: input.serviceTemplateId },
    select: { jobCategoryId: true },
  })
  if (!serviceTemplate) return []

  const rows = await client.$queryRaw<{ quote_id: string; price: bigint }[]>`
    SELECT jq.id as quote_id, COALESCE(mj."finalAuthorizedAmountCents", jq.price) as price
    FROM "JobQuote" jq
    JOIN "MarketplaceJob" mj ON mj.id = jq."jobId"
    LEFT JOIN "Dispute" d ON d."jobId" = mj.id AND d.status IN ('OPEN', 'UNDER_REVIEW')
    WHERE mj."categoryId" = ${serviceTemplate.jobCategoryId}
      AND mj."countryCode" = ${input.countryCode}
      AND mj.status = 'COMPLETED'
      AND jq.status = 'ACCEPTED'
      AND d.id IS NULL
  `

  return rows.map(r => ({ id: r.quote_id, amountCents: r.price }))
}

/**
 * Publish a benchmark — marks previous published version as SUPERSEDED.
 */
export async function publishBenchmark(
  client: PrismaClient,
  benchmarkId: string,
  publishedBy: string,
): Promise<{ success: boolean; error?: string }> {
  const benchmark = await client.priceBenchmark.findUnique({
    where: { id: benchmarkId },
  })

  if (!benchmark) return { success: false, error: 'Benchmark not found' }
  if (benchmark.status !== 'APPROVED') return { success: false, error: 'Only APPROVED benchmarks can be published' }

  const now = new Date()

  // Supersede any currently published benchmark for same service+geography
  const currentPublished = await client.priceBenchmark.findFirst({
    where: {
      serviceTemplateId: benchmark.serviceTemplateId,
      countryCode: benchmark.countryCode,
      region: benchmark.region,
      city: benchmark.city,
      currency: benchmark.currency,
      pricingMode: benchmark.pricingMode,
      status: 'PUBLISHED',
      id: { not: benchmarkId },
    },
  })

  if (currentPublished) {
    await client.priceBenchmark.update({
      where: { id: currentPublished.id },
      data: { status: 'SUPERSEDED', supersededBy: benchmarkId, effectiveTo: now },
    })
  }

  // Publish the new benchmark
  await client.priceBenchmark.update({
    where: { id: benchmarkId },
    data: {
      status: 'PUBLISHED',
      publishedAt: now,
      effectiveFrom: currentPublished ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000),
    },
  })

  return { success: true }
}

/**
 * Approve a draft benchmark.
 */
export async function approveBenchmark(
  client: PrismaClient,
  benchmarkId: string,
  approvedBy: string,
): Promise<{ success: boolean; error?: string }> {
  const benchmark = await client.priceBenchmark.findUnique({
    where: { id: benchmarkId },
  })

  if (!benchmark) return { success: false, error: 'Benchmark not found' }
  if (benchmark.status !== 'DRAFT' && benchmark.status !== 'UNDER_REVIEW') {
    return { success: false, error: 'Only DRAFT or UNDER_REVIEW benchmarks can be approved' }
  }

  await client.priceBenchmark.update({
    where: { id: benchmarkId },
    data: {
      status: 'APPROVED',
      approvedBy,
      approvedAt: new Date(),
    },
  })

  return { success: true }
}
