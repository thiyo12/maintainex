import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Payment-provider launch safety', () => {
  it('does not expose legacy PayPal or PayHere as an unapproved new customer checkout choice', () => {
    const confirm = source(
      'apps/mobile/features/jobs/screens/customer/v2/confirm/[id].tsx'
    )
    const paymentSettings = source(
      'apps/mobile/features/customer/screens/settings/payment/index.tsx'
    )

    expect(confirm).toContain('Continue to secure checkout')
    expect(confirm).not.toContain('Pay Securely with PayPal')
    expect(confirm).not.toContain('Pay Securely with PayHere')
    expect(paymentSettings).toContain('Not enabled for this deployment')
    expect(paymentSettings).not.toContain('PayPal online checkout')
    expect(paymentSettings).not.toContain('PayHere online checkout')
    expect(paymentSettings).not.toContain('methodPayHere')
    expect(paymentSettings).not.toContain('methodStripe')
  })

  it('keeps retired gateways read-only in CRM', () => {
    const page = source(
      'app/(admin)/admin/financial/providers/page.tsx'
    )

    expect(page).toContain('Retired · read only')
    expect(page).toContain('PayPal and PayHere are retired')
    expect(page).not.toContain('<option value="PAYHERE">PayHere</option>')
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

  describe('PayPal webhook signature verification', () => {
    const originalEnv = { ...process.env }

    beforeEach(() => {
      vi.resetModules()
      process.env.PAYPAL_CLIENT_ID = 'client-id'
      process.env.PAYPAL_CLIENT_SECRET = 'client-secret'
      process.env.PAYPAL_WEBHOOK_ID = 'webhook-id'
      process.env.PAYPAL_SANDBOX = 'true'
    })

    afterEach(() => {
      process.env = { ...originalEnv }
      vi.unstubAllGlobals()
    })

    it('fails closed when PayPal explicitly rejects the signature', async () => {
      const {
        verifyPayPalWebhook,
        resetPayPalAccessTokenCacheForTests,
      } = await import('@/lib/finance/payments/paypal-adapter')
      resetPayPalAccessTokenCacheForTests()

      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (String(url).includes('/v1/oauth2/token')) {
          return new Response(
            JSON.stringify({ access_token: 'token', expires_in: 300 }),
            { status: 200 }
          )
        }
        return new Response(
          JSON.stringify({ verification_status: 'FAILURE' }),
          { status: 200 }
        )
      }))

      const headers = new Headers({
        'paypal-transmission-id': 'tid',
        'paypal-transmission-time': 'ttime',
        'paypal-cert-url': 'https://api.paypal.com/cert.pem',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-transmission-sig': 'bad-signature',
      })

      await expect(
        verifyPayPalWebhook(headers, { id: 'WH-1' })
      ).resolves.toBe(false)
    })

    it('fails closed when required PayPal signature headers are missing', async () => {
      const { verifyPayPalWebhook } = await import(
        '@/lib/finance/payments/paypal-adapter'
      )

      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (String(url).includes('/v1/oauth2/token')) {
          return new Response(
            JSON.stringify({ access_token: 'token', expires_in: 300 }),
            { status: 200 }
          )
        }
        return new Response(
          JSON.stringify({ verification_status: 'SUCCESS' }),
          { status: 200 }
        )
      }))

      await expect(
        verifyPayPalWebhook(new Headers(), { id: 'WH-1' })
      ).resolves.toBe(false)
    })

    it('fails closed when no webhook ID is configured', async () => {
      process.env.PAYPAL_WEBHOOK_ID = ''
      const { verifyPayPalWebhook } = await import(
        '@/lib/finance/payments/paypal-adapter'
      )

      await expect(
        verifyPayPalWebhook(
          new Headers({ 'paypal-transmission-id': 'tid' }),
          { id: 'WH-1' }
        )
      ).resolves.toBe(false)
    })
  })

  it('closes retired PayPal redirect and webhook endpoints', () => {
    const returnRoute = source('app/api/payments/paypal/return/route.ts')
    const webhookRoute = source('app/api/webhooks/paypal/route.ts')
    expect(returnRoute).toContain('PAYMENT_PROVIDER_RETIRED')
    expect(returnRoute).toContain('status: 410')
    expect(webhookRoute).toContain('PAYMENT_PROVIDER_RETIRED')
    expect(webhookRoute).toContain('status: 410')
  })

  it('keeps webhook replay and payload mismatch protection', () => {
    const events = source('lib/finance/payments/provider-events.ts')
    expect(events).toContain('externalEventId')
    expect(events).toContain("error.code === 'P2002'")
    expect(events).toContain('Provider event replay payload mismatch')
    expect(events).toContain('payloadHash')
  })
})
