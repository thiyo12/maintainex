import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { categoryId, estimatedPrice, accepted, finalPrice } = body

    if (!categoryId || estimatedPrice == null) {
      return NextResponse.json({ error: 'categoryId and estimatedPrice are required' }, { status: 400 })
    }

    await prisma.historicalJobPrice.create({
      data: {
        jobId: `pending-${Date.now()}-${user.id}`,
        categoryId,
        countryCode: body.countryCode || 'LK',
        cityId: body.cityId || null,
        areaId: body.areaId || null,
        finalPrice: finalPrice ?? estimatedPrice,
        estimatedPrice,
        budgetAmount: estimatedPrice,
        complexity: body.complexity || 'medium',
        urgency: body.urgency || 'normal',
        duration: body.duration ? Number(body.duration) : null,
        workersCount: body.workersCount ? Number(body.workersCount) : 1,
        travelDistance: body.travelDistance ? Number(body.travelDistance) : null,
        isWeekend: body.isWeekend || false,
        isHoliday: body.isHoliday || false,
        isNight: body.isNight || false,
        materialCost: body.materialCost ? Number(body.materialCost) : null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to log pricing feedback' },
      { status: 500 }
    )
  }
}
