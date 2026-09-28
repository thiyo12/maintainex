import { NextRequest, NextResponse } from 'next/server'
import { calculateCustomerTrust } from '@/lib/trust-engine'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId') || user?.id

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
    }

    const trust = await calculateCustomerTrust(customerId)
    return NextResponse.json(trust)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to get trust score' }, { status: 500 })
  }
}
