import { NextRequest, NextResponse } from 'next/server'
import { checkProviderAvailability, setProviderAvailability, calculateAcceptanceProbability } from '@/lib/availability-engine'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId') || user?.id

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 })
    }

    const availability = await checkProviderAvailability(providerId)
    return NextResponse.json(availability)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to check availability' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    await setProviderAvailability(user.id, body)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update availability' }, { status: 500 })
  }
}
