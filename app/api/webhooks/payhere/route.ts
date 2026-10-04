import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import {
  getPayHereConfig,
  verifyNotificationSignature,
  type PayHereNotification,
} from '@/lib/payment/payhere-adapter'
import {
  processPaymentFailure,
  processPaymentSuccess,
} from '@/lib/payment/payment-service'

const MAX_BODY_BYTES = 16 * 1024
const SUPPORTED_STATUS_CODES = new Set(['2', '0', '-1', '-2', '-3'])

function scalar(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

async function readWebhookBody(request: NextRequest): Promise<Record<string, string> | null> {
  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null

  const contentType = (request.headers.get('content-type') || '').toLowerCase()
  if (
    !contentType.includes('application/x-www-form-urlencoded') &&
    !contentType.includes('application/json')
  ) {
    throw new Error('UNSUPPORTED_CONTENT_TYPE')
  }

  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return null

  if (contentType.includes('application/json')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('INVALID_JSON')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('INVALID_JSON')
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, scalar(value)])
    )
  }

  return Object.fromEntries(new URLSearchParams(text).entries())
}

export async function POST(request: NextRequest) {
  try {
    const config = getPayHereConfig()
    if (!config) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
    }

    const body = await readWebhookBody(request)
    if (!body) {
      return NextResponse.json({ error: 'Webhook payload too large' }, { status: 413 })
    }

    const notification: PayHereNotification = {
      merchant_id: scalar(body.merchant_id),
      order_id: scalar(body.order_id),
      payhere_amount: scalar(body.payhere_amount),
      payhere_currency: scalar(body.payhere_currency).toUpperCase(),
      status_code: scalar(body.status_code),
      md5sig: scalar(body.md5sig),
      payment_id: scalar(body.payment_id) || undefined,
      status_message: scalar(body.status_message) || undefined,
      custom_1: scalar(body.custom_1) || undefined,
      custom_2: scalar(body.custom_2) || undefined,
    }

    if (
      !notification.merchant_id ||
      !notification.order_id ||
      !notification.payhere_amount ||
      !notification.payhere_currency ||
      !notification.status_code ||
      !notification.md5sig
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!SUPPORTED_STATUS_CODES.has(notification.status_code)) {
      return NextResponse.json({ error: 'Unsupported payment status' }, { status: 400 })
    }

    if (notification.merchant_id !== config.merchantId) {
      return NextResponse.json({ error: 'Invalid merchant' }, { status: 403 })
    }

    const isValidSignature = verifyNotificationSignature(notification, config.merchantSecret)
    if (!isValidSignature) {
      logger.warn('PayHere webhook signature verification failed', { route: '/api/webhooks/payhere', method: 'POST' })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const statusCode = Number.parseInt(notification.status_code, 10)

    if (statusCode === 2) {
      const result = await processPaymentSuccess(notification)
      if (!result.success) {
        logger.error('PayHere success webhook processing failed', { route: '/api/webhooks/payhere', method: 'POST' })
        return NextResponse.json({ error: 'Payment processing conflict' }, { status: 409 })
      }
    } else {
      const result = await processPaymentFailure(notification)
      if (!result.success) {
        logger.error('PayHere failure webhook processing failed', { route: '/api/webhooks/payhere', method: 'POST' })
        return NextResponse.json({ error: result.error }, { status: 409 })
      }
    }

    return NextResponse.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN'
    if (message === 'UNSUPPORTED_CONTENT_TYPE') {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
    }
    if (message === 'INVALID_JSON') {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }
    logger.error('PayHere webhook failed unexpectedly', { err: error, route: '/api/webhooks/payhere', method: 'POST' })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
