import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { getSmartPriceEstimate } from '@/lib/smart-pricing'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { templateId, answers, countryCode, urgency, city, scheduledFor } = body

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
    }

    const estimate = await getSmartPriceEstimate({
      templateId,
      answers: answers || {},
      countryCode: countryCode || 'LK',
      urgency: urgency || 'normal',
      city,
      scheduledFor,
    })

    return NextResponse.json(estimate)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to estimate price' },
      { status: 500 }
    )
  }
}
