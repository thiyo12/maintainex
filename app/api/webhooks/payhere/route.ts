import { NextRequest, NextResponse } from 'next/server'
import { getPayHereConfig, verifyNotificationSignature, type PayHereNotification } from '@/lib/payment/payhere-adapter'
import { processPaymentSuccess, processPaymentFailure } from '@/lib/payment/payment-service'

export async function POST(request: NextRequest) {
  try {
    const config = getPayHereConfig()
    if (!config) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
    }

    let body: Record<string, string>
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      body = await request.json()
    } else {
      const text = await request.text()
      const params = new URLSearchParams(text)
      body = Object.fromEntries(params.entries())
    }

    const notification: PayHereNotification = {
      merchant_id: body.merchant_id || '',
      order_id: body.order_id || '',
      payhere_amount: body.payhere_amount || '',
      payhere_currency: body.payhere_currency || '',
      status_code: body.status_code || '',
      md5sig: body.md5sig || '',
      payment_id: body.payment_id,
      status_message: body.status_message,
      custom_1: body.custom_1,
      custom_2: body.custom_2,
    }

    if (!notification.merchant_id || !notification.order_id || !notification.md5sig) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (notification.merchant_id !== config.merchantId) {
      return NextResponse.json({ error: 'Invalid merchant' }, { status: 403 })
    }

    const isValidSignature = verifyNotificationSignature(notification, config.merchantSecret)
    if (!isValidSignature) {
      console.error('[SECURITY] PayHere webhook signature mismatch', {
        orderId: notification.order_id,
        merchantId: notification.merchant_id,
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const statusCode = parseInt(notification.status_code, 10)

    if (statusCode === 2) {
      const result = await processPaymentSuccess(notification)
      if (!result.success) {
        console.error('PayHere success processing failed:', result.error)
        return NextResponse.json({ error: result.error }, { status: 500 })
      }
    } else {
      const result = await processPaymentFailure(notification)
      if (!result.success) {
        console.error('PayHere failure processing failed:', result.error)
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('PayHere webhook error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
