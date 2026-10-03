import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const prismaMocks = vi.hoisted(() => ({
  eventCreate: vi.fn(),
  eventFindFirst: vi.fn(),
  eventUpdateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentProviderEvent: {
      create: prismaMocks.eventCreate,
      findFirst: prismaMocks.eventFindFirst,
      updateMany: prismaMocks.eventUpdateMany,
    },
  },
}))

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  })
}

describe('PayPal-only new payment strategy', () => {
  describe('duplicate provider events cannot duplicate ledger entries', () => {
    beforeEach(() => {
      vi.resetModules()
      prismaMocks.eventCreate.mockReset()
      prismaMocks.eventFindFirst.mockReset()
    })

    it('records a verified event once and treats a replay as a duplicate', async () => {
      const { recordVerifiedProviderEvent } = await import(
        '@/lib/finance/payments/provider-events'
      )
      const { hashProviderEventPayload } = await import(
        '@/lib/finance/payments/provider-events'
      )

      const rawBody = JSON.stringify({ id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' })

      prismaMocks.eventCreate.mockResolvedValueOnce({ id: 'evt-1' })
      const first = await recordVerifiedProviderEvent({
        provider: 'PAYPAL',
        externalEventId: 'WH-1',
        eventType: 'PAYMENT.CAPTURE.COMPLETED',
        rawBody,
        payload: { id: 'WH-1' },
      })
      expect(first).toEqual({ created: true, eventId: 'evt-1' })

      // PayPal redelivers the same event: unique constraint rejects the insert.
      prismaMocks.eventCreate.mockRejectedValueOnce(uniqueViolation())
      prismaMocks.eventFindFirst.mockResolvedValueOnce({
        id: 'evt-1',
        payloadHash: hashProviderEventPayload(rawBody),
      })

      const replay = await recordVerifiedProviderEvent({
        provider: 'PAYPAL',
        externalEventId: 'WH-1',
        eventType: 'PAYMENT.CAPTURE.COMPLETED',
        rawBody,
        payload: { id: 'WH-1' },
      })

      expect(replay).toEqual({ created: false, eventId: 'evt-1' })
    })

    it('rejects a replayed event ID carrying a different payload', async () => {
      const { recordVerifiedProviderEvent } = await import(
        '@/lib/finance/payments/provider-events'
      )

      prismaMocks.eventCreate.mockRejectedValueOnce(uniqueViolation())
      prismaMocks.eventFindFirst.mockResolvedValueOnce({
        id: 'evt-1',
        payloadHash: 'a'.repeat(64),
      })

      await expect(
        recordVerifiedProviderEvent({
          provider: 'PAYPAL',
          externalEventId: 'WH-1',
          eventType: 'PAYMENT.CAPTURE.COMPLETED',
          rawBody: JSON.stringify({ id: 'WH-1', amount: '999.00' }),
          payload: { id: 'WH-1', amount: '999.00' },
        })
      ).rejects.toThrow('Provider event replay payload mismatch')
    })
  })

  describe('invalid PayPal webhook signatures are rejected', () => {
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
    })

    it('fails closed when PayPal does not confirm the signature', async () => {
      const { verifyPayPalWebhook, resetPayPalAccessTokenCacheForTests } = await import(
        '@/lib/finance/payments/paypal-adapter'
      )
      resetPayPalAccessTokenCacheForTests()

      const fetchMock = vi.fn(async (url: string) => {
        if (String(url).includes('/v1/oauth2/token')) {
          return new Response(
            JSON.stringify({ access_token: 'token', expires_in: 300 }),
            { status: 200 }
          )
        }
        // PayPal explicitly refuses the signature.
        return new Response(
          JSON.stringify({ verification_status: 'FAILURE' }),
          { status: 200 }
        )
      })
      vi.stubGlobal('fetch', fetchMock)

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

      vi.unstubAllGlobals()
    })

    it('fails closed when required PayPal signature headers are missing', async () => {
      const { verifyPayPalWebhook } = await import(
        '@/lib/finance/payments/paypal-adapter'
      )

      const fetchMock = vi.fn(async (url: string) => {
        if (String(url).includes('/v1/oauth2/token')) {
          return new Response(
            JSON.stringify({ access_token: 'token', expires_in: 300 }),
            { status: 200 }
          )
        }
        return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
          status: 200,
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      // No signature headers at all: verification must fail even though PayPal's
      // verification endpoint would otherwise report SUCCESS.
      await expect(
        verifyPayPalWebhook(new Headers(), { id: 'WH-1' })
      ).resolves.toBe(false)

      vi.unstubAllGlobals()
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

  describe('the PayPal webhook route verifies before it records', () => {
    it('rejects an unverified signature before processing the event', () => {
      const route = source('app/api/webhooks/paypal/route.ts')

      const verifyIndex = route.indexOf('verifyPayPalWebhook')
      const processIndex = route.indexOf('processVerifiedPayPalWebhook')
      expect(verifyIndex).toBeGreaterThan(-1)
      expect(processIndex).toBeGreaterThan(verifyIndex)
      expect(route).toContain("{ error: 'Invalid signature' }, { status: 403 }")
      expect(route).toContain('no-store')
    })

    it('returns a retriable failure only after a verified event is recorded', () => {
      const route = source('app/api/webhooks/paypal/route.ts')
      expect(route).toContain('{ status: 500')
      expect(route).toContain('duplicate')
      expect(route).toContain('ignored')
    })
  })

  describe('Sri Lanka PayPal capability stays unverified by default', () => {
    const originalEnv = { ...process.env }

    afterEach(() => {
      process.env = { ...originalEnv }
      vi.resetModules()
    })

    it('blocks LK until an operator records verified capability', async () => {
      vi.resetModules()
      delete process.env.PAYPAL_MARKET_CHECKOUT_VERIFIED

      const { isPayPalMarketVerified, verifiedPayPalMarkets } = await import(
        '@/lib/finance/payments/provider-registry'
      )

      expect(verifiedPayPalMarkets()).toEqual([])
      expect(isPayPalMarketVerified('LK')).toBe(false)
      expect(isPayPalMarketVerified('lk')).toBe(false)
    })

    it('allows LK only when LK is explicitly listed as verified', async () => {
      vi.resetModules()
      process.env.PAYPAL_MARKET_CHECKOUT_VERIFIED = 'ca, lk'

      const { isPayPalMarketVerified } = await import(
        '@/lib/finance/payments/provider-registry'
      )

      expect(isPayPalMarketVerified('LK')).toBe(true)
      expect(isPayPalMarketVerified('CA')).toBe(true)
    })

    it('does not implicitly verify LK when another market is verified', async () => {
      vi.resetModules()
      process.env.PAYPAL_MARKET_CHECKOUT_VERIFIED = 'CA'

      const { isPayPalMarketVerified } = await import(
        '@/lib/finance/payments/provider-registry'
      )

      expect(isPayPalMarketVerified('CA')).toBe(true)
      expect(isPayPalMarketVerified('LK')).toBe(false)
    })
  })

  describe('client input can never mark a payment successful', () => {
    it('never trusts a browser redirect as payment proof', () => {
      const returnRoute = source('app/api/payments/paypal/return/route.ts')

      expect(returnRoute).toContain('captureAndFinalizePayPal')
      expect(returnRoute).toContain(
        'No client-side success result is trusted as payment proof.'
      )
    })

    it('never accepts a query-string success flag in the payment intent flow', () => {
      const service = source('lib/finance/payments/payment-service.ts')
      const registry = source('lib/finance/payments/provider-registry.ts')

      for (const text of [service, registry]) {
        expect(text).not.toMatch(/status\s*=\s*['"]SUCCESS['"]/)
        expect(text).not.toMatch(/searchParams\.get\(['"](success|paid|status)['"]\)/)
      }
    })
  })

  describe('PayPal credentials stay server-side', () => {
    it('never exposes PayPal secrets through provider config or the CRM', () => {
      const schema = source('prisma/schema.prisma')
      const providerApi = source('app/api/admin/financial/providers/route.ts')

      const providerBlock = schema.slice(
        schema.indexOf('model PaymentProviderConfig {'),
        schema.indexOf('model PaymentIntent {')
      )
      expect(providerBlock).not.toMatch(/clientSecret|clientId|webhookId|webhookSecret/)

      expect(providerApi).not.toMatch(/PAYPAL_CLIENT_SECRET|PAYPAL_WEBHOOK_ID/)
    })

    it('does not leak PayPal secrets to any public or mobile surface', () => {
      const publicFiles = [
        'app/(public)/home/client.tsx',
        'app/(public)/about/client.tsx',
        'app/(public)/contact/client.tsx',
      ]

      for (const file of publicFiles) {
        const text = source(file)
        expect(text).not.toContain('PAYPAL_CLIENT_SECRET')
        expect(text).not.toContain('PAYPAL_WEBHOOK_ID')
      }
    })
  })

  describe('historical PayHere financial history stays readable', () => {
    it('keeps legacy PayHere models, adapters and reconciliation in place', () => {
      const schema = source('prisma/schema.prisma')

      expect(schema).toContain('model PaymentProviderTransaction')
      expect(schema).toContain('model PaymentProviderRefund')
      expect(schema).toContain('model PaymentProviderEvent')

      // Legacy PayHere adapters and the refund reconciliation cron remain so old
      // payments stay auditable.
      expect(() => source('lib/finance/payments/payhere-adapter.ts')).not.toThrow()
      expect(() => source('lib/payment/payhere-adapter.ts')).not.toThrow()
      expect(() => source('app/api/cron/payhere-refunds/route.ts')).not.toThrow()
      expect(() => source('app/api/webhooks/payhere/route.ts')).not.toThrow()
    })

    it('never deletes legacy PayHere financial rows', () => {
      const bootstrap = source('scripts/bootstrap-payment-providers.cjs')

      expect(bootstrap).not.toMatch(/\.(deleteMany|delete|deleteMany)\s*\(/)
      expect(bootstrap).not.toContain('deleteMany')
      expect(bootstrap).not.toContain('paymentIntent')
      expect(bootstrap).not.toContain('paymentProviderTransaction')
      expect(bootstrap).not.toContain('paymentProviderRefund')
      expect(bootstrap).not.toContain('paymentProviderEvent')
    })

    it('keeps the schema able to express a legacy PayHere provider row', () => {
      const registry = source('lib/finance/payments/provider-registry.ts')
      expect(registry).toContain("PAYMENT_PROVIDER_CODES = ['PAYPAL', 'PAYHERE', 'MANUAL_BANK']")
    })
  })

  describe('the provider abstraction is preserved for future providers', () => {
    it('keeps provider-neutral canonical payment models and a provider registry', () => {
      const registry = source('lib/finance/payments/provider-registry.ts')

      expect(registry).toContain('resolvePaymentProviderForMarket')
      expect(registry).toContain('selectProviderFromConfigs')
      expect(registry).toContain('PaymentProviderCapabilities')
      expect(registry).toContain('PaymentProviderConfigLike')
    })

    it('keeps PayPal dispatched through the provider abstraction, not hard-coded', () => {
      const service = source('lib/finance/payments/payment-service.ts')
      expect(service).toContain('resolvePaymentProviderForMarket')
      expect(service).toContain('validateProviderRuntimeConfig')
    })
  })
})