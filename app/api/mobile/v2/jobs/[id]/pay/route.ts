import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { createPaymentIntent } from '@/lib/payment/payment-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const rateLimitResponse = await requireFinancialRateLimit(request, 'payment-create')
    if (rateLimitResponse) return rateLimitResponse

    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const host = forwardedHost || request.headers.get('host') || 'localhost'
    const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = `${protocol}://${host}`

    const result = await createPaymentIntent({
      jobId: id,
      customerId: user.id,
      baseUrl,
    })

    if (!result.success) {
      const statusCode = result.code === 'UNAUTHORIZED' ? 403
        : result.code === 'JOB_NOT_FOUND' ? 404
        : result.code === 'ESCROW_NOT_INITIALIZED' ? 400
        : result.code === 'ESCROW_NOT_FUNDABLE' ? 409
        : result.code === 'PAYHERE_NOT_CONFIGURED' ? 501
        : 400
      return NextResponse.json({ error: result.error, code: result.code }, { status: statusCode })
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: result.checkoutUrl,
      merchantOrderId: result.merchantOrderId,
      paymentIntentId: result.paymentIntentId,
    })
  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
