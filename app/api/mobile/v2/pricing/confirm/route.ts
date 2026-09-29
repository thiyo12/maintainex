import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { calculatePrice, PriceBoundsError, PricingInputError } from '@/lib/pricing/engine'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { categoryId, serviceTemplateId, accepted } = body
    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 })
    }

    const estimate = await calculatePrice(prisma, {
      jobId: `estimate-confirm-${Date.now()}-${user.id}`,
      categoryId,
      serviceTemplateId: serviceTemplateId || undefined,
      mode: 'QUOTE',
      urgency: (body.urgency?.toUpperCase() || 'NORMAL') as 'NORMAL' | 'URGENT' | 'EMERGENCY',
      quantity: body.workersCount ? Number(body.workersCount) : undefined,
      durationMinutes: body.duration ? Number(body.duration) : undefined,
      countryCode: body.countryCode || 'GLOBAL',
    })

    // Do not insert into HistoricalJobPrice here. That table is training truth and
    // should only receive trusted completed-job outcomes, not client-submitted prices.
    return NextResponse.json({
      success: true,
      accepted: Boolean(accepted),
      estimate: {
        customerTotal: estimate.customerTotal.toString(),
        providerGross: estimate.providerGross.toString(),
        platformFeeAmount: estimate.platformFeeAmount.toString(),
        currency: estimate.currency,
        pricingVersion: estimate.pricingVersion,
      },
    })
  } catch (error: any) {
    if (error instanceof PricingInputError || error instanceof PriceBoundsError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error?.message || 'Failed to confirm pricing' }, { status: 500 })
  }
}
