import { NextRequest, NextResponse } from 'next/server'
import { checkProviderAvailability, setProviderAvailability, calculateAcceptanceProbability } from '@/lib/availability-engine'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const requestedId = searchParams.get('providerId')
    if (requestedId && requestedId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const availability = await checkProviderAvailability(user.id)
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
    if (user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    await setProviderAvailability(user.id, body)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    const message = error?.message || 'Failed to update availability'
    const isValidationError =
      message.startsWith('Invalid availability field') || message === 'No valid availability fields provided'
    return NextResponse.json({ error: message }, { status: isValidationError ? 400 : 500 })
  }
}
