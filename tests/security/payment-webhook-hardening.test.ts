import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('payment webhook hardening', () => {
  it('PayHere rejects oversized/unsupported/unsigned or wrong-merchant callbacks before payment mutation', () => {
    const route = source('app/api/webhooks/payhere/route.ts')

    expect(route).toContain('MAX_BODY_BYTES')
    expect(route).toContain('application/x-www-form-urlencoded')
    expect(route).toContain('application/json')
    expect(route).toContain('SUPPORTED_STATUS_CODES')
    expect(route).toContain('notification.merchant_id !== config.merchantId')
    expect(route).toContain('verifyNotificationSignature')
    expect(route).toContain("{ error: 'Invalid signature' }, { status: 403 }")

    const signatureIndex = route.indexOf('verifyNotificationSignature')
    const successIndex = route.indexOf('processPaymentSuccess')
    const failureIndex = route.indexOf('processPaymentFailure')
    expect(signatureIndex).toBeGreaterThan(-1)
    expect(signatureIndex).toBeLessThan(successIndex)
    expect(signatureIndex).toBeLessThan(failureIndex)
  })

  it('PayHere adapter signs/verifies amount, currency, status and order identity together', () => {
    const adapter = source('lib/finance/payments/payhere-adapter.ts')

    expect(adapter).toContain('notification.merchant_id')
    expect(adapter).toContain('notification.order_id')
    expect(adapter).toContain('notification.payhere_amount')
    expect(adapter).toContain('notification.payhere_currency')
    expect(adapter).toContain('notification.status_code')
    expect(adapter).toContain('notification.md5sig')
  })

  it('PayPal verifies provider signature before canonical event processing', () => {
    const route = source('app/api/webhooks/paypal/route.ts')

    expect(route).toContain('MAX_BODY_BYTES')
    expect(route).toContain("contentType.includes('application/json')")
    expect(route).toContain('verifyPayPalWebhook')
    expect(route).toContain("{ error: 'Invalid signature' },")
    expect(route).toContain('processVerifiedPayPalWebhook')

    expect(route.indexOf('verifyPayPalWebhook')).toBeLessThan(
      route.indexOf('processVerifiedPayPalWebhook({')
    )
  })

  it('PayPal signature verification requires all transmission headers and server-side webhook verification', () => {
    const adapter = source('lib/finance/payments/paypal-adapter.ts')

    for (const header of [
      'paypal-transmission-id',
      'paypal-transmission-time',
      'paypal-cert-url',
      'paypal-auth-algo',
      'paypal-transmission-sig',
    ]) {
      expect(adapter).toContain(header)
    }

    expect(adapter).toContain('/v1/notifications/verify-webhook-signature')
    expect(adapter).toContain("response.body?.verification_status === 'SUCCESS'")
  })

  it('canonical provider capture rejects amount and currency mismatches', () => {
    const capture = source('lib/finance/payments/canonical-capture.ts')
    expect(capture).toContain('PAYMENT_AMOUNT_MISMATCH')
    expect(capture).toContain('PAYMENT_CURRENCY_MISMATCH')
  })

  it('verified provider events are replay-protected and payload mismatch is treated as an integrity error', () => {
    const events = source('lib/finance/payments/provider-events.ts')

    expect(events).toContain('providerEventId')
    expect(events).toContain('payloadHash')
    expect(events).toContain('Provider event replay payload mismatch')
    expect(events).toContain('duplicate')
  })
})
