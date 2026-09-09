import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePrice, PriceBoundsError, PricingInputError } from '@/lib/pricing/engine'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

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

    const estimate = await calculatePrice(prisma, {
      jobId: `estimate-${Date.now()}-${user.id}`,
      categoryId: categoryId || '',
      serviceTemplateId: templateId || undefined,
      mode: 'QUOTE',
      urgency: (urgency?.toUpperCase() || 'NORMAL') as 'NORMAL' | 'URGENT' | 'EMERGENCY',
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      countryCode: countryCode || 'GLOBAL',
    })

    return NextResponse.json({
      estimate: {
        baseAmount: Number(estimate.baseAmount),
        urgencyAmount: Number(estimate.urgencyAmount),
        serviceModifiers: Number(estimate.serviceModifiers),
        providerGross: Number(estimate.providerGross),
        platformFeeBps: estimate.platformFeeBps,
        platformFeeAmount: Number(estimate.platformFeeAmount),
        customerTotal: Number(estimate.customerTotal),
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
        { error: error.message, minAmount: Number(error.minCents), maxAmount: Number(error.maxCents), actual: Number(error.actual) },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error?.message || 'Failed to estimate price' }, { status: 500 })
  }
}
