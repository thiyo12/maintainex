import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('payment provider control plane', () => {
  it('keeps provider credentials outside Prisma models', () => {
    const schema = source('prisma/schema.prisma')
    const providerBlock = schema.slice(
      schema.indexOf('model PaymentProviderConfig {'),
      schema.indexOf('model PaymentIntent {')
    )

    expect(providerBlock).toContain('supportedCurrencies')
    expect(providerBlock).toContain('capabilities')
    expect(providerBlock).not.toMatch(/clientSecret|webhookSecret|accessToken|refreshToken/)
  })

  it('persists unique provider events for webhook replay protection', () => {
    const schema = source('prisma/schema.prisma')
    expect(schema).toContain('model PaymentProviderEvent {')
    expect(schema).toContain('@@unique([provider, externalEventId])')

    const events = source('lib/finance/payments/provider-events.ts')
    expect(events).toContain("error.code === 'P2002'")
    expect(events).toContain('Provider event replay payload mismatch')
    expect(events).toContain('signatureVerified: true')
  })

  it('preserves PayHere history but disables it for new checkout at boot', () => {
    const schema = source('prisma/schema.prisma')
    const bootstrap = source('scripts/bootstrap-payment-providers.cjs')
    const docker = source('Dockerfile')

    expect(schema).toContain('model PaymentProviderTransaction')
    expect(schema).toContain('model PaymentProviderRefund')
    expect(schema).toContain('model PaymentProviderEvent')
    expect(bootstrap).toContain("where: { provider: 'PAYHERE' }")
    expect(bootstrap).toContain('enabled: false')
    expect(bootstrap).toContain("operationalStatus: 'DISABLED'")
    expect(bootstrap).toContain('updateMany')
    expect(bootstrap).not.toContain('paymentProviderConfig.upsert')
    expect(bootstrap).not.toContain('paymentProviderConfig.create')
    expect(bootstrap).not.toContain('deleteMany')
    expect(docker).toContain('node scripts/bootstrap-payment-providers.cjs')
  })

  it('restricts new online checkout to PayPal with market verification', () => {
    const registry = source('lib/finance/payments/provider-registry.ts')
    const service = source('lib/finance/payments/payment-service.ts')
    const providersApi = source('app/api/admin/financial/providers/route.ts')

    expect(registry).toContain("NEW_ONLINE_CHECKOUT_PROVIDER_CODES = ['PAYPAL']")
    expect(registry).toContain("LEGACY_READ_ONLY_PROVIDER_CODES = ['PAYHERE']")
    expect(registry).toContain('PAYPAL_MARKET_CHECKOUT_VERIFIED')
    expect(registry).toContain("PAYPAL_SANDBOX_FIXTURE_COUNTRY = 'CA'")
    expect(registry).toContain("PAYPAL_LIVE_HARD_BLOCKED_MARKETS = new Set(['LK'])")

    expect(service).toContain('PAYMENT_PROVIDER_NOT_AVAILABLE')
    expect(service).toContain("if (provider.provider !== 'PAYPAL')")
    expect(providersApi).toContain('isLegacyReadOnlyProvider(provider)')
    expect(providersApi).toContain('isPayPalMarketVerified(countryCode')
  })

  it('blocks the legacy PayHere hosted checkout route', () => {
    const route = source('app/api/payments/payhere/[intentId]/route.ts')

    expect(route).toContain('PAYHERE_DISABLED_FOR_NEW_CHECKOUT')
    expect(route).toContain('status: 410')
    expect(route).not.toContain('getPaymentCheckoutForm')
    expect(route).not.toContain('checkout.actionUrl')
  })

  it('keeps payment reconciliation on a dedicated sensitive permission', () => {
    const permissions = source('lib/crm/governance/permissions.ts')
    const catalog = source('lib/crm/governance/permission-catalog.ts')
    const route = source('app/api/admin/financial/payments/[id]/route.ts')

    expect(permissions).toContain("'finance:payments:reconcile'")
    expect(catalog).toContain("'finance:payments:reconcile'")
    expect(route).toContain("permission: mode === 'read' ? 'finance:payments:view' : 'finance:payments:reconcile'")
    expect(route).not.toContain("permission: mode === 'read' ? 'finance:payments:view' : 'finance:commission:reconcile'")
  })

  it('documents PayPal secrets as server-only environment variables', () => {
    const env = source('.env.example')
    expect(env).toContain('PAYPAL_CLIENT_ID=')
    expect(env).toContain('PAYPAL_CLIENT_SECRET=')
    expect(env).toContain('PAYPAL_WEBHOOK_ID=')
    expect(env).toContain('PAYPAL_MARKET_CHECKOUT_VERIFIED=')
    expect(env).not.toContain('NEXT_PUBLIC_PAYPAL_CLIENT_SECRET')
    expect(env).not.toContain('NEXT_PUBLIC_PAYPAL_WEBHOOK_ID')
  })
})
