import { NextRequest, NextResponse } from 'next/server'
import { getPaymentStatus } from '@/lib/payment/payment-service'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payment = await getPaymentStatus(id, user.id)
    if (!payment) return NextResponse.json({ payment: null })

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('Payment status error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
