import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePrice, PriceBoundsError, PricingInputError } from '@/lib/pricing/engine'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { CURRENCY_SYMBOLS, minorUnitsToMajorUnits, getCurrencyForCountry, type Currency } from '@/lib/shared/money/money'
import { isCatalogAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { templateId, categoryId, urgency, countryCode, durationMinutes } = body
    const market = typeof countryCode === 'string' && countryCode.trim()
      ? countryCode.trim().toUpperCase()
      : (user.countryCode || 'LK').trim().toUpperCase()
    if (market !== 'LK' && market !== 'CA') {
      return NextResponse.json({ error: 'Unsupported pricing market' }, { status: 400 })
    }
    const expectedCurrency = getCurrencyForCountry(market)

    if (!templateId && !categoryId) {
      return NextResponse.json({ error: 'templateId or categoryId is required' }, { status: 400 })
    }

    const template = templateId
      ? await prisma.serviceTemplate.findUnique({
          where: { id: templateId },
          select: {
            id: true,
            jobCategoryId: true,
            isActive: true,
            countryCode: true,
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

    if (template && categoryId && categoryId !== template.jobCategoryId) {
      return NextResponse.json({ error: 'Service template does not belong to category' }, { status: 400 })
    }
    const resolvedCategoryId = categoryId || template?.jobCategoryId || ''
    if (!resolvedCategoryId) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 })
    }
    const category = await prisma.jobCategory.findUnique({
      where: { id: resolvedCategoryId },
      select: { isActive: true, countries: true },
    })
    if (!category?.isActive || !isCatalogAvailableInMarket(category.countries, market)) {
      return NextResponse.json({ error: 'Service category unavailable in this market' }, { status: 400 })
    }
    if (template && (!template.isActive || template.countryCode !== market || template.currency !== expectedCurrency)) {
      return NextResponse.json({ error: 'No verified local pricing for this service' }, { status: 422 })
    }
    if (market === 'CA' && !template) {
      return NextResponse.json({ error: 'A locally priced service is required for a Canadian estimate' }, { status: 422 })
    }
    if (market === 'CA') {
      const config = await prisma.marketConfig.findUnique({
        where: { countryCode: 'CA' },
        select: { defaultCurrency: true },
      })
      if (config?.defaultCurrency !== 'CAD') {
        return NextResponse.json({ error: 'Canadian pricing is not configured' }, { status: 422 })
      }
    }
    const requestedUrgency = typeof urgency === 'string' ? urgency.toUpperCase() : 'NORMAL'
    if (!['NORMAL', 'URGENT', 'EMERGENCY'].includes(requestedUrgency)) {
      return NextResponse.json({ error: 'Invalid urgency' }, { status: 400 })
    }
    if (durationMinutes !== undefined && (!Number.isFinite(Number(durationMinutes)) || Number(durationMinutes) <= 0)) {
      return NextResponse.json({ error: 'durationMinutes must be positive' }, { status: 400 })
    }
    const estimate = await calculatePrice(prisma, {
      jobId: `estimate-${Date.now()}-${user.id}`,
      categoryId: resolvedCategoryId,
      serviceTemplateId: templateId || undefined,
      mode: 'QUOTE',
      urgency: requestedUrgency as 'NORMAL' | 'URGENT' | 'EMERGENCY',
      durationMinutes: durationMinutes ? Number(durationMinutes) : template?.defaultDurationMinutes || undefined,
      countryCode: market,
    })

    // Calculation must not silently inherit LKR from an incomplete CA config.
    if (estimate.currency !== expectedCurrency) {
      return NextResponse.json({ error: 'Pricing currency does not match the selected market' }, { status: 422 })
    }
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
