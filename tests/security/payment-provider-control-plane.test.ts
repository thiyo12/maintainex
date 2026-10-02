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

  it('documents PayPal secrets as server-only environment variables', () => {
    const env = source('.env.example')
    expect(env).toContain('PAYPAL_CLIENT_ID=')
    expect(env).toContain('PAYPAL_CLIENT_SECRET=')
    expect(env).toContain('PAYPAL_WEBHOOK_ID=')
    expect(env).not.toContain('NEXT_PUBLIC_PAYPAL_CLIENT_SECRET')
    expect(env).not.toContain('NEXT_PUBLIC_PAYPAL_WEBHOOK_ID')
  })
})
