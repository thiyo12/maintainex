import { NextRequest, NextResponse } from 'next/server'
import { calculateCustomerTrust } from '@/lib/trust-engine'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const requestedCustomerId = searchParams.get('customerId')
    if (requestedCustomerId !== null && requestedCustomerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Authentication resolves this ID from the canonical User row. Never use
    // caller-controlled query data to select another customer's trust profile.
    const trust = await calculateCustomerTrust(user.id)
    return NextResponse.json(trust)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to get trust score' }, { status: 500 })
  }
}
