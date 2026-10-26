import { NextRequest, NextResponse } from 'next/server'
import { calculateProviderQuality } from '@/lib/quality-engine'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    if (user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requestedProviderId = searchParams.get('providerId')
    if (requestedProviderId !== null && requestedProviderId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Quality aggregates include internal flags and recalculation updates the
    // cached metric; always bind both to the authenticated tasker identity.
    const quality = await calculateProviderQuality(user.id)
    return NextResponse.json(quality)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to get quality' }, { status: 500 })
  }
}
