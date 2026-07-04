import { NextRequest, NextResponse } from 'next/server'
import { calculateProviderQuality } from '@/lib/quality-engine'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get('providerId') || user?.id

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 })
    }

    const quality = await calculateProviderQuality(providerId)
    return NextResponse.json(quality)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to get quality' }, { status: 500 })
  }
}
