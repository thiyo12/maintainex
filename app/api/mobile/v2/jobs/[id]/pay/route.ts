import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { createPaymentIntent } from '@/lib/payment/payment-service'
import { resolvePaymentPublicOrigin } from '@/lib/finance/payments/public-origin'

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

    const baseUrl = resolvePaymentPublicOrigin(request.url)
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Payment public URL is not configured', code: 'PAYMENT_ORIGIN_NOT_CONFIGURED' },
        { status: 503 }
      )
    }

    const result = await createPaymentIntent({
      jobId: id,
      customerId: user.id,
      baseUrl,
    })

    if (!result.success) {
      const statusCode =
        result.code === 'UNAUTHORIZED' ? 403 :
        result.code === 'JOB_NOT_FOUND' ? 404 :
        result.code === 'PAYHERE_NOT_CONFIGURED' ? 503 :
        result.code === 'CUSTOMER_PAYMENT_DETAILS_REQUIRED' ? 400 :
        409
      return NextResponse.json(result, { status: statusCode })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
