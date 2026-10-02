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


  it('requires explicit payment providers and bootstraps only the legacy Sri Lanka PayHere path from runtime configuration', () => {
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
    expect(bootstrap).toContain("countryCode: 'LK'")
    expect(bootstrap).toContain("provider: 'PAYHERE'")
    expect(bootstrap).toContain("const value = process.env[name]")
    expect(bootstrap).toContain("boolEnv('PAYHERE_SANDBOX', true)")
    expect(bootstrap).not.toContain('PAYHERE_MERCHANT_SECRET=')
    expect(docker).toContain('node scripts/bootstrap-payment-providers.cjs')
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
