import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveBenchmark, resolveBenchmarkConfig } from '@/lib/pricing/benchmark'
import { classifyQuoteAmount } from '@/lib/pricing/classification'
import { suggestPrice } from '@/lib/price-suggester'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { serviceTemplateId, serviceName, countryCode, region, city, currency, proposedAmountCents, description } = body

    if (!serviceTemplateId || !countryCode || !currency) {
      return NextResponse.json(
        { error: 'serviceTemplateId, countryCode, and currency are required' },
        { status: 400 }
      )
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
    if (proposedAmountCents !== undefined && benchmark) {
      classification = classifyQuoteAmount(BigInt(proposedAmountCents), benchmark)
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
