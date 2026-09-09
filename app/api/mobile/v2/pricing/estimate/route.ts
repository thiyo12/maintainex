import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePrice, PriceBoundsError, PricingInputError } from '@/lib/pricing/engine'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

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
      countryCode: typeof countryCode === 'string' && countryCode.trim() ? countryCode.trim().toUpperCase() : 'GLOBAL',
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
