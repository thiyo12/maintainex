import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveBenchmark, resolveBenchmarkConfig } from '@/lib/pricing/benchmark'
import { classifyQuoteAmount } from '@/lib/pricing/classification'
import { suggestPrice } from '@/lib/price-suggester'
import { checkRateLimit, ipKey } from '@/lib/rate-limit/middleware'

function parseMinorAmount(value: unknown): bigint | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) return null
    return BigInt(value)
  }
  if (typeof value === 'string' && /^\d{1,18}$/.test(value)) {
    return BigInt(value)
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(request, {
      policyName: 'PRICING_QUERY',
      keyPrefix: 'public_price_suggest',
      identifier: ipKey(request),
    })
    if (!rateLimit.allowed) return rateLimit.response!

    const body = await request.json().catch(() => ({}))
    const { serviceTemplateId, serviceName, countryCode, region, city, currency, proposedAmountCents, description } = body

    if (
      typeof serviceTemplateId !== 'string' ||
      !serviceTemplateId ||
      serviceTemplateId.length > 128 ||
      typeof countryCode !== 'string' ||
      !/^[A-Za-z]{2}$/.test(countryCode) ||
      typeof currency !== 'string' ||
      !/^[A-Za-z]{3}$/.test(currency)
    ) {
      return NextResponse.json(
        { error: 'Valid serviceTemplateId, countryCode, and currency are required' },
        { status: 400 }
      )
    }

    const parsedAmount = parseMinorAmount(proposedAmountCents)
    if (proposedAmountCents !== undefined && proposedAmountCents !== null && parsedAmount === null) {
      return NextResponse.json({ error: 'Invalid proposedAmountCents' }, { status: 400 })
    }

    // Resolve benchmark (customer-safe: no internal IDs exposed)
    const benchmark = await resolveBenchmark(prisma, {
      serviceTemplateId,
      countryCode,
      region,
      city,
      currency,
      pricingMode: 'SMART_QUOTE',
    })

    // Get config for classification thresholds
    const config = await resolveBenchmarkConfig(prisma, countryCode)

    let classification = 'INSUFFICIENT_DATA'
    if (parsedAmount !== null && benchmark) {
      classification = classifyQuoteAmount(parsedAmount, benchmark)
    }

    // Get suggested price from existing system (whole currency units, not cents)
    const suggestion = suggestPrice(serviceName ?? serviceTemplateId, countryCode, description ?? '')

    // Customer-safe response: NO internal IDs, NO benchmark IDs, NO provider data
    const response: Record<string, unknown> = {
      hasBenchmark: benchmark !== null,
      benchmark: benchmark
        ? {
            currency: benchmark.currency,
            medianAmountCents: benchmark.medianAmountCents,
            lowerPercentileCents: benchmark.lowerPercentileCents,
            upperPercentileCents: benchmark.upperPercentileCents,
            geographyLevel: benchmark.geographyLevel,
            confidence: benchmark.confidence,
            sampleSize: benchmark.sampleSize,
          }
        : null,
      classification,
      suggestion: suggestion
        ? {
            suggestedPrice: suggestion.suggestedPrice,
            minPrice: suggestion.minPrice,
            maxPrice: suggestion.maxPrice,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
          }
        : null,
      config: {
        benchmarkPercentileLow: config.benchmarkPercentileLow,
        benchmarkPercentileHigh: config.benchmarkPercentileHigh,
        benchmarkFallbackEnabled: config.benchmarkFallbackEnabled,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Price suggest error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
