import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePrice, PriceBoundsError, PricingInputError } from '@/lib/pricing/engine'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { CURRENCY_SYMBOLS, minorUnitsToMajorUnits, type Currency } from '@/lib/shared/money/money'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { templateId, categoryId, urgency, countryCode, durationMinutes } = body

    if (!templateId && !categoryId) {
      return NextResponse.json({ error: 'templateId or categoryId is required' }, { status: 400 })
    }

    const template = templateId
      ? await prisma.serviceTemplate.findUnique({
          where: { id: templateId },
          select: {
            id: true,
            jobCategoryId: true,
            priceMin: true,
            priceMax: true,
            defaultDurationMinutes: true,
            currency: true,
          },
        })
      : null

    if (templateId && !template) {
      return NextResponse.json({ error: 'Service template not found' }, { status: 404 })
    }

    const resolvedCategoryId = categoryId || template?.jobCategoryId || ''
    const estimate = await calculatePrice(prisma, {
      jobId: `estimate-${Date.now()}-${user.id}`,
      categoryId: resolvedCategoryId,
      serviceTemplateId: templateId || undefined,
      mode: 'QUOTE',
      urgency: (urgency?.toUpperCase() || 'NORMAL') as 'NORMAL' | 'URGENT' | 'EMERGENCY',
      durationMinutes: durationMinutes ? Number(durationMinutes) : template?.defaultDurationMinutes || undefined,
      countryCode: countryCode || user.countryCode || 'LK',
    })

    const currency = estimate.currency as Currency
    const base = minorUnitsToMajorUnits(estimate.baseAmount, currency)
    const customerTotal = minorUnitsToMajorUnits(estimate.customerTotal, currency)

    let min = customerTotal
    let max = customerTotal
    if (
      template &&
      typeof template.priceMin === 'number' &&
      typeof template.priceMax === 'number' &&
      base > 0
    ) {
      const canonicalMultiplier = customerTotal / base
      min = Math.round(template.priceMin * canonicalMultiplier * 100) / 100
      max = Math.round(template.priceMax * canonicalMultiplier * 100) / 100
      if (min > max) [min, max] = [max, min]
    }

    return NextResponse.json({
      currency,
      symbol: CURRENCY_SYMBOLS[currency],
      priceRange: {
        min,
        max,
        base: customerTotal,
      },
      breakdown: [
        { label: 'Base service', factor: base },
        { label: 'Urgency', factor: minorUnitsToMajorUnits(estimate.urgencyAmount, currency) },
        { label: 'Service modifiers', factor: minorUnitsToMajorUnits(estimate.serviceModifiers, currency) },
        { label: 'Platform fee', factor: minorUnitsToMajorUnits(estimate.platformFeeAmount, currency) },
      ],
      timeEstimateMinutes: template?.defaultDurationMinutes || (durationMinutes ? Number(durationMinutes) : 60),
      confidence: template ? 'high' : 'medium',
      canonical: {
        providerGrossMinor: estimate.providerGross.toString(),
        platformFeeMinor: estimate.platformFeeAmount.toString(),
        customerTotalMinor: estimate.customerTotal.toString(),
        pricingVersion: estimate.pricingVersion,
        ruleIds: estimate.ruleIds,
      },
    })
  } catch (error: any) {
    if (error instanceof PricingInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof PriceBoundsError) {
      return NextResponse.json(
        {
          error: error.message,
          minAmountMinor: String(error.minCents),
          maxAmountMinor: String(error.maxCents),
          actualMinor: String(error.actual),
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error?.message || 'Failed to estimate price' }, { status: 500 })
  }
}
