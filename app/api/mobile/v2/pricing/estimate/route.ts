import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePrice, PriceBoundsError, PricingInputError } from '@/lib/pricing/engine'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { getCurrencyForCountry } from '@/lib/shared/money/money'

function parsePositiveNumber(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { categoryId, serviceTemplateId, urgency, countryCode } = body
    if (typeof categoryId !== 'string' || !categoryId.trim()) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 })
    }

    // A preview is not a binding quote. Only use market-specific pricing
    // when the selected service and pricing configuration support that market.
    // LK remains the compatibility default until service-address resolution
    // is integrated into this preview endpoint.
    const market = typeof countryCode === 'string' && countryCode.trim()
      ? countryCode.trim().toUpperCase()
      : 'LK'
    if (market !== 'LK' && market !== 'CA') {
      return NextResponse.json({ error: 'Unsupported pricing market' }, { status: 400 })
    }
    const expectedCurrency = getCurrencyForCountry(market)
    const category = await prisma.jobCategory.findUnique({
      where: { id: categoryId.trim() },
      select: { isActive: true, countries: true },
    })
    const isMarketEligible = (stored: string) => {
      try {
        const codes: unknown = JSON.parse(stored)
        return Array.isArray(codes) && codes.includes(market)
      } catch { return false }
    }
    if (!category?.isActive || !isMarketEligible(category.countries)) {
      return NextResponse.json({ error: 'Service category unavailable in this market' }, { status: 400 })
    }
    if (serviceTemplateId) {
      if (typeof serviceTemplateId !== 'string') {
        return NextResponse.json({ error: 'Invalid service template' }, { status: 400 })
      }
      const template = await prisma.serviceTemplate.findUnique({
        where: { id: serviceTemplateId },
        select: { isActive: true, jobCategoryId: true, countryCode: true, currency: true },
      })
      if (!template?.isActive || template.jobCategoryId !== categoryId.trim() ||
          template.countryCode !== market || template.currency !== expectedCurrency) {
        return NextResponse.json({ error: 'No verified local pricing for this service' }, { status: 422 })
      }
    } else if (market === 'CA') {
      // Category-level template prices currently include LKR seed values.
      // Do not silently re-label those averages as CAD.
      return NextResponse.json({ error: 'A locally priced service is required for a Canadian estimate' }, { status: 422 })
    }
    if (market === 'CA') {
      const config = await prisma.marketConfig.findUnique({
        where: { countryCode: 'CA' }, select: { defaultCurrency: true },
      })
      if (config?.defaultCurrency !== 'CAD') {
        return NextResponse.json({ error: 'Canadian pricing is not configured' }, { status: 422 })
      }
    }

    const quantity = parsePositiveNumber(body.quantity)
    const durationMinutes = parsePositiveNumber(body.durationMinutes)
    if (quantity === null || durationMinutes === null) {
      return NextResponse.json({ error: 'quantity and durationMinutes must be positive finite numbers' }, { status: 400 })
    }

    const estimate = await calculatePrice(prisma, {
      jobId: `estimate-${Date.now()}-${user.id}`,
      categoryId: categoryId.trim(),
      serviceTemplateId: typeof serviceTemplateId === 'string' && serviceTemplateId.trim() ? serviceTemplateId.trim() : undefined,
      mode: 'QUOTE',
      urgency: (typeof urgency === 'string' ? urgency.toUpperCase() : 'NORMAL') as 'NORMAL' | 'URGENT' | 'EMERGENCY',
      quantity,
      durationMinutes,
      countryCode: market,
    })

    return NextResponse.json({
      estimate: {
        baseAmount: estimate.baseAmount.toString(),
        urgencyAmount: estimate.urgencyAmount.toString(),
        serviceModifiers: estimate.serviceModifiers.toString(),
        providerGross: estimate.providerGross.toString(),
        platformFeeBps: estimate.platformFeeBps,
        platformFeeAmount: estimate.platformFeeAmount.toString(),
        customerTotal: estimate.customerTotal.toString(),
        currency: estimate.currency,
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
          minAmount: error.minCents.toString(),
          maxAmount: error.maxCents.toString(),
          actual: error.actual.toString(),
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error?.message || 'Failed to estimate price' }, { status: 500 })
  }
}
