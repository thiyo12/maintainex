import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('PayPal-only launch strategy', () => {
  it('does not expose PayHere as a new customer checkout choice', () => {
    const confirm = source(
      'apps/mobile/features/jobs/screens/customer/v2/confirm/[id].tsx'
    )
    const paymentSettings = source(
      'apps/mobile/features/customer/screens/settings/payment/index.tsx'
    )

    expect(confirm).toContain('Pay Securely with PayPal')
    expect(confirm).not.toContain('Pay Securely with PayHere')
    expect(paymentSettings).toContain('PayPal online checkout')
    expect(paymentSettings).not.toContain('methodPayHere')
    expect(paymentSettings).not.toContain('methodStripe')
  })

  it('keeps both active payment creation routes on the same fail-closed policy', () => {
    const paymentRoute = source(
      'app/api/mobile/v2/jobs/[id]/payment/route.ts'
    )
    const payRoute = source(
      'app/api/mobile/v2/jobs/[id]/pay/route.ts'
    )

    for (const route of [paymentRoute, payRoute]) {
      expect(route).toContain('createPaymentIntent')
      expect(route).toContain('PAYMENT_PROVIDER_NOT_AVAILABLE')
      expect(route).not.toContain("result.code === 'PAYHERE_NOT_CONFIGURED'")
    }
  })

  it('keeps historical receipts provider-neutral', () => {
    const receipt = source(
      'apps/mobile/features/jobs/screens/customer/receipt/[id].tsx'
    )
    expect(receipt).toContain("'Online payment'")
    expect(receipt).not.toContain('PayHere / Card')
  })

  it('fails closed on unsupported wallet top-up instead of showing fake funding details', () => {
    const topup = source(
      'apps/mobile/features/payments/screens/customer/wallet/topup.tsx'
    )
    expect(topup).toContain('Wallet top-up is not available yet')
    expect(topup).not.toContain('123-456-789')
    expect(topup).not.toContain('/api/mobile/v2/wallet/topup')
    expect(topup).not.toContain("id: 'payhere'")
    expect(topup).not.toContain("id: 'stripe'")
  })

  it('keeps PayHere legacy services for historical refunds and audit only', () => {
    const service = source('lib/finance/payments/payment-service.ts')
    const bootstrap = source('scripts/bootstrap-payment-providers.cjs')
    const hostedRoute = source('app/api/payments/payhere/[intentId]/route.ts')

    expect(service).toContain('requestRequiredPayHereRefund')
    expect(service).toContain('reconcilePayHereRefund')
    expect(service).not.toContain('getPaymentCheckoutForm')
    expect(service).not.toContain('generateCheckoutHash')
    expect(bootstrap).toContain("where: { provider: 'PAYHERE' }")
    expect(bootstrap).not.toContain('paymentProviderConfig.upsert')
    expect(hostedRoute).toContain('status: 410')
  })

  it('requires server verification before a PayPal redirect can protect payment', () => {
    const returnRoute = source('app/api/payments/paypal/return/route.ts')
    const webhookRoute = source('app/api/webhooks/paypal/route.ts')
    const canonicalCapture = source('lib/finance/payments/canonical-capture.ts')

    expect(returnRoute).toContain('captureAndFinalizePayPal')
    expect(returnRoute).toContain(
      'No client-side success result is trusted as payment proof.'
    )
    expect(webhookRoute).toContain('verifyPayPalWebhook')
    expect(webhookRoute).toContain("{ error: 'Invalid signature' }, { status: 403 }")
    expect(canonicalCapture).toContain("status: 'PROTECTED'")
    expect(canonicalCapture).toContain('PAYMENT_AMOUNT_MISMATCH')
    expect(canonicalCapture).toContain('PAYMENT_CURRENCY_MISMATCH')
  })

  it('keeps webhook replay and payload mismatch protection', () => {
    const events = source('lib/finance/payments/provider-events.ts')
    expect(events).toContain('externalEventId')
    expect(events).toContain("error.code === 'P2002'")
    expect(events).toContain('Provider event replay payload mismatch')
    expect(events).toContain('payloadHash')
  })
})
