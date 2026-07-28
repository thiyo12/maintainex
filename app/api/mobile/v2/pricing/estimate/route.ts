import { NextRequest, NextResponse } from 'next/server'
import { getPriceEstimate } from '@/lib/pricing-engine'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()
    const {
      categoryId, categoryName, description, title,
      areaId, cityId, stateId, countryCode,
      urgency, preferredDate, preferredTime,
      estimatedDuration, workersCount, materialHandling,
    } = body

    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 })
    }

    const estimate = await getPriceEstimate({
      categoryId,
      categoryName: categoryName || title,
      description: description || '',
      title,
      areaId,
      cityId,
      stateId,
      countryCode: countryCode || (user ? undefined : 'LK'),
      urgency: urgency || 'normal',
      preferredDate,
      preferredTime,
      estimatedDuration: estimatedDuration ? Number(estimatedDuration) : undefined,
      workersCount: workersCount ? Number(workersCount) : undefined,
      materialHandling: materialHandling || 'tasker_brings',
    })

    return NextResponse.json(estimate)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to estimate price' },
      { status: 500 }
    )
  }
}
