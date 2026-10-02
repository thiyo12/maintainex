import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent, getPaymentStatus } from '@/lib/payment/payment-service'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
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

    const rateLimitResponse = await requireFinancialRateLimit(request, 'payment-intent')
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
      const status =
        result.code === 'UNAUTHORIZED' ? 403 :
        result.code === 'JOB_NOT_FOUND' ? 404 :
        [
'PAYPAL_NOT_CONFIGURED',
            'PAYMENT_PROVIDER_NOT_AVAILABLE',
            'PAYPAL_ENVIRONMENT_MISMATCH',
            'PAYMENT_PROVIDER_CHECKOUT_UNSUPPORTED',
        ].includes(result.code || '') ? 503 :
        result.code === 'CUSTOMER_PAYMENT_DETAILS_REQUIRED' ? 400 :
        409
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Create payment intent error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

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
