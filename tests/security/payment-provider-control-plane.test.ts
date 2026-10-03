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


  it('requires explicit payment providers and never bootstraps PayHere for new checkout', () => {
    const schema = source('prisma/schema.prisma')
    const explicitMigration = source(
      'prisma/migrations/20261002173500_payment_intent_explicit_provider/migration.sql'
    )
    const bootstrap = source('scripts/bootstrap-payment-providers.cjs')
    const docker = source('Dockerfile')

    const paymentIntentStart = schema.indexOf('model PaymentIntent {')
    const paymentIntentEnd = schema.indexOf('\n}', paymentIntentStart)
    const paymentIntentBlock = schema.slice(paymentIntentStart, paymentIntentEnd + 2)

    expect(paymentIntentBlock).toContain('gateway         String')
    expect(paymentIntentBlock).not.toContain('@default("PAYPAL")')
    expect(explicitMigration).toContain('ALTER COLUMN "gateway" DROP DEFAULT')

    // PayHere must never be auto-created, auto-activated or bootstrapped.
    expect(bootstrap).not.toContain("countryCode: 'LK'")
    expect(bootstrap).not.toContain("provider: 'PAYHERE',")
    expect(bootstrap).not.toContain('paymentProviderConfig.upsert')
    expect(bootstrap).not.toContain('paymentProviderConfig.create')
    expect(bootstrap).not.toContain('deleteMany')
    expect(bootstrap).not.toContain('PAYHERE_MERCHANT_SECRET=')
    expect(bootstrap).not.toContain('boolEnv')

    // Legacy PayHere rows are preserved but forced to disabled for new checkout.
    expect(bootstrap).toContain('enabled: false')
    expect(bootstrap).toContain("operationalStatus: 'DISABLED'")
    expect(bootstrap).toContain('findMany')
    expect(bootstrap).toContain('updateMany')

    expect(docker).toContain('node scripts/bootstrap-payment-providers.cjs')
  })

  it('restricts new online checkout to PayPal and blocks unverified markets', () => {
    const registry = source('lib/finance/payments/provider-registry.ts')
    const service = source('lib/finance/payments/payment-service.ts')
    const providersApi = source('app/api/admin/financial/providers/route.ts')

    expect(registry).toContain("NEW_ONLINE_CHECKOUT_PROVIDER_CODES = ['PAYPAL']")
    expect(registry).toContain("LEGACY_READ_ONLY_PROVIDER_CODES = ['PAYHERE']")
    expect(registry).toContain('blockedNewCheckoutReason')
    expect(registry).toContain('PAYPAL_UNVERIFIED_MARKET_CODES')

    // Sri Lanka must stay blocked until the live merchant account is verified.
    expect(registry).toContain("new Set(['LK'])")
    expect(registry).toContain('PAYPAL_MARKET_CHECKOUT_VERIFIED')

    // Fail closed rather than falling back to PayHere.
    expect(service).toContain('PAYMENT_PROVIDER_NOT_AVAILABLE')
    expect(service).not.toContain('PAYMENT_PROVIDER_NOT_ENABLED')
    expect(service).not.toContain("provider.provider === 'PAYHERE'")

    // Staff must not be able to re-enable PayHere or bypass the LK gate.
    expect(providersApi).toContain('isLegacyReadOnlyProvider(provider)')
    expect(providersApi).toContain('isPayPalMarketVerified(countryCode)')
  })

  it('blocks the legacy PayHere hosted checkout route', () => {
    const route = source('app/api/payments/payhere/[intentId]/route.ts')

    expect(route).toContain('PAYHERE_DISABLED_FOR_NEW_CHECKOUT')
    expect(route).toContain('status: 410')
    expect(route).not.toContain('getPaymentCheckoutForm')
    expect(route).not.toContain('checkout.actionUrl')
    expect(route).not.toContain('pay/checkout')
  })

  it('keeps PayHere out of customer-facing checkout wording', () => {
    const confirm = source(
      'apps/mobile/features/jobs/screens/customer/v2/confirm/[id].tsx'
    )
    const receipt = source(
      'apps/mobile/features/jobs/screens/customer/receipt/[id].tsx'
    )
    const topup = source(
      'apps/mobile/features/payments/screens/customer/wallet/topup.tsx'
    )

    expect(confirm).not.toContain('Pay Securely with PayHere')
    expect(confirm).toContain('Pay Securely with PayPal')
    expect(receipt).not.toContain('PayHere / Card')
    expect(topup).not.toContain("id: 'payhere'")
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
    expect(env).not.toContain('NEXT_PUBLIC_PAYPAL_CLIENT_SECRET')
    expect(env).not.toContain('NEXT_PUBLIC_PAYPAL_WEBHOOK_ID')
  })
})
