import { PrismaClient } from '@prisma/client'
import type {
  BenchmarkResolution,
  BenchmarkConfig,
  GeographyLevel,
  PricingMode,
} from './benchmark-types'

/**
 * Canonical benchmark resolution with geographic fallback hierarchy.
 *
 * Fallback order: CITY → PROVINCE → COUNTRY → NO BENCHMARK
 *
 * Only PUBLISHED benchmarks within effective date range are returned.
 */
export async function resolveBenchmark(
  client: PrismaClient,
  params: {
    serviceTemplateId: string
    countryCode: string
    region?: string | null
    city?: string | null
    currency: string
    pricingMode: PricingMode
    asOf?: Date
  },
): Promise<BenchmarkResolution | null> {
  const now = params.asOf || new Date()

  // Try each geographic level in order
  const attempts: Array<{ region: string | null; city: string | null; level: GeographyLevel }> = []

  if (params.city) {
    attempts.push({ region: params.region || null, city: params.city, level: 'CITY' })
  }
  if (params.region) {
    attempts.push({ region: params.region, city: null, level: 'PROVINCE' })
  }
  attempts.push({ region: null, city: null, level: 'COUNTRY' })

  for (const attempt of attempts) {
    const benchmark = await findPublishedBenchmark(client, {
      serviceTemplateId: params.serviceTemplateId,
      countryCode: params.countryCode,
      region: attempt.region,
      city: attempt.city,
      currency: params.currency,
      pricingMode: params.pricingMode,
      now,
    })

    if (benchmark) {
      const confidence = deriveConfidence(benchmark.sampleSize, params.serviceTemplateId)
      return {
        ...benchmark,
        geographyLevel: attempt.level,
        confidence,
      }
    }
  }

  return null
}

async function findPublishedBenchmark(
  client: PrismaClient,
  params: {
    serviceTemplateId: string
    countryCode: string
    region: string | null
    city: string | null
    currency: string
    pricingMode: string
    now: Date
  },
): Promise<Omit<BenchmarkResolution, 'geographyLevel' | 'confidence'> | null> {
  const benchmark = await client.priceBenchmark.findFirst({
    where: {
      serviceTemplateId: params.serviceTemplateId,
      countryCode: params.countryCode,
      region: params.region,
      city: params.city,
      currency: params.currency,
      pricingMode: params.pricingMode,
      status: 'PUBLISHED',
      effectiveFrom: { lte: params.now },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: params.now } },
      ],
    },
    orderBy: [
      { version: 'desc' },
      { publishedAt: 'desc' },
    ],
  })

  if (!benchmark) return null

  return {
    benchmarkId: benchmark.id,
    serviceTemplateId: benchmark.serviceTemplateId,
    countryCode: benchmark.countryCode,
    region: benchmark.region,
    city: benchmark.city,
    currency: benchmark.currency,
    pricingMode: benchmark.pricingMode as PricingMode,
    sampleSize: benchmark.sampleSize,
    medianAmountCents: benchmark.medianAmountCents,
    lowerPercentileCents: benchmark.lowerPercentileCents,
    upperPercentileCents: benchmark.upperPercentileCents,
    minimumObservedCents: benchmark.minimumObservedCents,
    maximumObservedCents: benchmark.maximumObservedCents,
    sourceType: benchmark.sourceType as any,
    sourceReference: benchmark.sourceReference,
    methodologyNote: benchmark.methodologyNote,
    version: benchmark.version,
    effectiveFrom: benchmark.effectiveFrom,
    effectiveTo: benchmark.effectiveTo,
  }
}

function deriveConfidence(sampleSize: number, _serviceTemplateId: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (sampleSize >= 30) return 'HIGH'
  if (sampleSize >= 10) return 'MEDIUM'
  return 'LOW'
}

/**
 * Resolve the current benchmark config from MarketConfig.
 */
export async function resolveBenchmarkConfig(
  client: PrismaClient,
  countryCode: string = 'GLOBAL',
): Promise<BenchmarkConfig> {
  const config = await client.marketConfig.findUnique({
    where: { countryCode },
  })

  if (!config) {
    const globalConfig = await client.marketConfig.findUnique({
      where: { countryCode: 'GLOBAL' },
    })
    if (globalConfig) return extractConfig(globalConfig)
    return DEFAULT_BENCHMARK_CONFIG
  }

  return extractConfig(config)
}

function extractConfig(config: any): BenchmarkConfig {
  return {
    minBenchmarkSample: config.minBenchmarkSample ?? 5,
    benchmarkPercentileLow: config.benchmarkPercentileLow ?? 25,
    benchmarkPercentileHigh: config.benchmarkPercentileHigh ?? 75,
    benchmarkOutlierIqrMult: config.benchmarkOutlierIqrMult ?? 1.5,
    benchmarkFallbackEnabled: config.benchmarkFallbackEnabled ?? true,
    benchmarkResearchIntervalMonths: config.benchmarkResearchIntervalMonths ?? 3,
  }
}

const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  minBenchmarkSample: 5,
  benchmarkPercentileLow: 25,
  benchmarkPercentileHigh: 75,
  benchmarkOutlierIqrMult: 1.5,
  benchmarkFallbackEnabled: true,
  benchmarkResearchIntervalMonths: 3,
}

/**
 * Find all published benchmarks for a service template (for admin listing / history).
 */
export async function listBenchmarks(
  client: PrismaClient,
  params: {
    serviceTemplateId?: string
    countryCode?: string
    status?: string
    limit?: number
    offset?: number
  },
) {
  const where: any = {}
  if (params.serviceTemplateId) where.serviceTemplateId = params.serviceTemplateId
  if (params.countryCode) where.countryCode = params.countryCode
  if (params.status) where.status = params.status

  const [items, total] = await Promise.all([
    client.priceBenchmark.findMany({
      where,
      orderBy: [{ serviceTemplateId: 'asc' }, { countryCode: 'asc' }, { version: 'desc' }],
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    }),
    client.priceBenchmark.count({ where }),
  ])

  return { items, total }
}
