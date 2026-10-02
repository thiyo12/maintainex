import { NextRequest, NextResponse } from 'next/server'
import {
  getPayPalConfig,
  verifyPayPalWebhook,
} from '@/lib/finance/payments/paypal-adapter'
import { processVerifiedPayPalWebhook } from '@/lib/finance/payments/paypal-service'

const MAX_BODY_BYTES = 256 * 1024

export async function POST(request: NextRequest) {
  try {
    const config = getPayPalConfig()
    if (!config?.webhookId) {
      return NextResponse.json(
        { error: 'PayPal webhook is not configured' },
        { status: 503 }
      )
    }

    const contentType = (request.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 415 }
      )
    }

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Webhook payload too large' },
        { status: 413 }
      )
    }

    const rawBody = await request.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Webhook payload too large' },
        { status: 413 }
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    const event = parsed as Record<string, unknown>
    const verified = await verifyPayPalWebhook(request.headers, event)
    if (!verified) {
      console.error('[SECURITY] PayPal webhook signature verification failed', {
        eventId: typeof event.id === 'string' ? event.id : null,
        eventType: typeof event.event_type === 'string' ? event.event_type : null,
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const result = await processVerifiedPayPalWebhook({ rawBody, event })
    if (!result.success) {
      console.error('PayPal webhook processing failed:', result.error)
      // Return a retriable server failure only after the signature has been
      // verified and the event has been safely recorded.
      return NextResponse.json(
        { error: result.error || 'Webhook processing failed' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      {
        status: 'ok',
        duplicate: Boolean(result.duplicate),
        ignored: Boolean(result.ignored),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('PayPal webhook error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
