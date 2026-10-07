import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  isPayPalConfigured,
  onlinePaymentAvailability,
} from '@/lib/finance/payments/provider-registry'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const PAYPAL_ENV_KEYS = [
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
] as const

const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of PAYPAL_ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of PAYPAL_ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key] as string
  }
})

describe('canonical online payment availability', () => {
  it('reports unavailable when no provider is configured', () => {
    expect(isPayPalConfigured()).toBe(false)
    expect(onlinePaymentAvailability()).toEqual({
      onlinePaymentAvailable: false,
      provider: null,
      reason: 'not_configured',
    })
  })

  it('reports available only when the full provider set is configured', () => {
    process.env.PAYPAL_CLIENT_ID = 'id'
    expect(isPayPalConfigured()).toBe(false)
    process.env.PAYPAL_CLIENT_SECRET = 'secret'
    expect(isPayPalConfigured()).toBe(false)
    process.env.PAYPAL_WEBHOOK_ID = 'hook'
    expect(isPayPalConfigured()).toBe(true)
    expect(onlinePaymentAvailability()).toEqual({
      onlinePaymentAvailable: true,
      provider: 'PAYPAL',
      reason: 'available',
    })
  })
})

describe('availability endpoint and client contract', () => {
  const route = 'app/api/mobile/v2/payments/availability/route.ts'

  it('exposes only derived availability, never credentials', () => {
    const code = source(route)
    expect(code).toContain('onlinePaymentAvailability()')
    expect(code).toContain("reason: 'not_configured'")
    expect(code).toContain('cashAvailable: true')
    expect(code).not.toContain('PAYPAL_CLIENT_SECRET')
    expect(code).not.toContain('process.env.PAYPAL_CLIENT_SECRET')
  })

  it('fails closed for clients when the lookup throws', () => {
    const code = source(route)
    expect(code).toContain('onlinePaymentAvailable: false')
    expect(code).toContain('cashAvailable: true')
  })

  it('mobile client reads the contract instead of hardcoding an online option', () => {
    const client = source('apps/mobile/api/v2-payments.ts')
    expect(client).toContain('/api/mobile/v2/payments/availability')
    expect(client).toContain('onlinePaymentAvailable')

    const confirm = source('apps/mobile/features/jobs/screens/customer/v2/confirm/[id].tsx')
    expect(confirm).toContain('v2Payments')
    expect(confirm).toContain('.availability()')
    // PayPal is only offered when the contract says it is available; cash stays.
    expect(confirm).toContain('onlinePaymentAvailable ? (')
    expect(confirm).toContain('Online payment is not available')
    expect(confirm).toContain('Use Cash Instead')
  })

  it('payment settings reports online checkout as not configured', () => {
    const settings = source('apps/mobile/features/customer/screens/settings/payment/index.tsx')
    expect(settings).toContain('.availability()')
    expect(settings).toContain('onlinePaymentAvailable')
    expect(settings).toContain("'Unavailable'")
  })
})

describe('server-side enforcement is unchanged', () => {
  it('startup validation still refuses sandbox PayPal in production', () => {
    const env = source('lib/config/env-validation.ts')
    expect(env).toContain('PAYPAL_SANDBOX must be explicitly false')
  })

  it('creation routes still fail closed with PAYMENT_PROVIDER_NOT_AVAILABLE', () => {
    const registry = source('lib/finance/payments/provider-registry.ts')
    expect(registry).toContain("PAYMENT_PROVIDER_NOT_AVAILABLE = 'PAYMENT_PROVIDER_NOT_AVAILABLE'")
    const createRoute = source('app/api/mobile/v2/jobs/[id]/payment/route.ts')
    expect(createRoute).toContain('PAYMENT_PROVIDER_NOT_AVAILABLE')
  })
})

describe('preflight treats intentionally absent PayPal as disabled', () => {
  const preflight = source('scripts/crm-v2-production-preflight.sh')

  it('reports PAYPALMODE disabled when no PayPal credential exists', () => {
    expect(preflight).toContain("paypal_present=0")
    expect(preflight).toContain("PAYPALMODE='disabled'")
  })

  it('still fails closed on an incomplete PayPal credential set', () => {
    expect(preflight).toContain('ERROR|incomplete PayPal production configuration')
    expect(preflight).toContain('if [ "$paypal_present" = "0" ]; then')
  })

  it('keeps strict rules when PayPal is fully configured', () => {
    expect(preflight).toContain("PAYPALMODE='live'")
    expect(preflight).toContain("PAYPALMODE='sandbox-smoke-authorized'")
    expect(preflight).toContain('ERROR|PayPal production configuration must explicitly disable sandbox')
  })

  it('does not weaken application startup validation', () => {
    expect(preflight).not.toContain('env-validation')
    expect(source('lib/config/env-validation.ts')).toContain(
      'PAYPAL_SANDBOX must be explicitly false',
    )
  })
})