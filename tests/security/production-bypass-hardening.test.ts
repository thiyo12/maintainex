import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const originalEnv = { ...process.env }
const strong = (label: string) => `${label}-0123456789abcdef0123456789abcdef0123456789abcdef`

function validProductionEnv() {
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
  process.env.MARKETPLACE_JWT_SECRET = strong('marketplace')
  process.env.STAFF_JWT_SECRET = strong('staff')
  process.env.JWT_SECRET = strong('legacy-jwt')
  process.env.PASSWORD_PEPPER = strong('password-pepper')
  process.env.IDENTITY_CLAIM_PEPPER = strong('identity-pepper')
  process.env.INTERNAL_SYNC_SECRET = strong('internal-sync')
  process.env.CRON_SECRET = strong('cron')
  process.env.ALLOW_TEST_OTP = 'false'
  process.env.APP_RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567'

  delete process.env.PAYPAL_CLIENT_ID
  delete process.env.PAYPAL_CLIENT_SECRET
  delete process.env.PAYPAL_WEBHOOK_ID
  delete process.env.PAYPAL_SANDBOX
  delete process.env.PAYHERE_MERCHANT_ID
  delete process.env.PAYHERE_MERCHANT_SECRET
  delete process.env.PAYHERE_APP_ID
  delete process.env.PAYHERE_APP_SECRET
  delete process.env.PAYHERE_SANDBOX
}

describe('production security configuration fails closed', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    validProductionEnv()
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('accepts a complete production configuration with test OTP disabled', async () => {
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')
    expect(validateRequiredSecrets()).toEqual({ valid: true, errors: [] })
  })

  it('requires an exact traceable release SHA in production', async () => {
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')

    delete process.env.APP_RELEASE_SHA
    let result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('[CRITICAL] APP_RELEASE_SHA is required in production')

    process.env.APP_RELEASE_SHA = 'not-a-git-sha'
    result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('[CRITICAL] APP_RELEASE_SHA must be a lowercase 40-character git SHA')
  })
  it('rejects ALLOW_TEST_OTP=true in production', async () => {
    process.env.ALLOW_TEST_OTP = 'true'
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')
    const result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('[CRITICAL] ALLOW_TEST_OTP must not be enabled in production')
  })

  it('rejects missing or short security secrets in production', async () => {
    delete process.env.IDENTITY_CLAIM_PEPPER
    process.env.CRON_SECRET = 'short'
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')
    const result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.includes('IDENTITY_CLAIM_PEPPER is missing'))).toBe(true)
    expect(result.errors.some(error => error.includes('CRON_SECRET is too short'))).toBe(true)
  })

  it('rejects shared password and identity peppers', async () => {
    process.env.IDENTITY_CLAIM_PEPPER = process.env.PASSWORD_PEPPER
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')
    const result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('[CRITICAL] PASSWORD_PEPPER and IDENTITY_CLAIM_PEPPER must be independent')
  })

  it('rejects production PayPal credentials unless sandbox is explicitly false and complete', async () => {
    process.env.PAYPAL_CLIENT_ID = 'client'
    process.env.PAYPAL_CLIENT_SECRET = 'secret'
    process.env.PAYPAL_SANDBOX = 'true'
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')
    const result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.includes('PAYPAL_WEBHOOK_ID is required'))).toBe(true)
    expect(result.errors.some(error => error.includes('PAYPAL_SANDBOX must be explicitly false'))).toBe(true)
  })

  it('rejects PayHere production reconciliation credentials when sandbox is not explicitly false', async () => {
    process.env.PAYHERE_MERCHANT_ID = 'merchant'
    process.env.PAYHERE_MERCHANT_SECRET = 'secret'
    process.env.PAYHERE_APP_ID = 'app'
    process.env.PAYHERE_APP_SECRET = 'app-secret'
    process.env.PAYHERE_SANDBOX = 'true'
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')
    const result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.includes('PAYHERE_SANDBOX must be explicitly false'))).toBe(true)
  })

  it('throws during production startup instead of continuing with an unsafe configuration', async () => {
    process.env.ALLOW_TEST_OTP = 'true'
    const { ensureSecretsValidated } = await import('@/lib/config/env-validation')
    expect(() => ensureSecretsValidated()).toThrow('[SECURITY] Production startup validation failed')
  })

  it('never enables the synthetic 000000 OTP in production', async () => {
    process.env.ALLOW_TEST_OTP = 'true'
    const { INTERACTIVE_TEST_PHONES, getInteractiveTestRole, isTestOtpAllowed } = await import('@/lib/test-cert')
    const tasker = {
      email: 'demo.tasker@maintainex-test.lk',
      phone: INTERACTIVE_TEST_PHONES.TASKER,
      name: 'MaintainEX Demo Tasker',
    }
    expect(getInteractiveTestRole(tasker.phone)).toBeNull()
    expect(isTestOtpAllowed(tasker, '000000')).toBe(false)
  })
})

describe('production seed/setup endpoints are independently disabled', () => {
  const routes = [
    'app/api/internal/security/seed/route.ts',
    'app/api/industries/init/route.ts',
    'app/api/industries/setup/route.ts',
    'app/api/mobile/v2/admin/seed-categories/route.ts',
    'app/api/seed/auto/route.ts',
    'app/api/seed/real-estate/route.ts',
    'app/api/seed/services/route.ts',
    'app/api/seed/test-data/route.ts',
  ]

  for (const route of routes) {
    it(`${route} has an explicit production denial in the route itself`, () => {
      const code = source(route)
      expect(code).toContain("process.env.NODE_ENV === 'production'")
      expect(code).toMatch(/status:\s*(?:403|404)/)
    })
  }

  it('production preflight refuses an unknown release identity', () => {
    const preflight = source('scripts/crm-v2-production-preflight.sh')
    expect(preflight).toContain('APP_RELEASE_SHA')
    expect(preflight).toContain('ERROR|APP_RELEASE_SHA is required')
    expect(preflight).not.toContain('release_sha=unknown')
  })
  it('runs production secret validation during Node startup', () => {
    const instrumentation = source('instrumentation.ts')
    expect(instrumentation).toContain("process.env.NEXT_RUNTIME === 'nodejs'")
    expect(instrumentation).toContain("import('./lib/config/env-validation')")
    expect(instrumentation).toContain('ensureSecretsValidated()')
  })

  it('keeps the middleware-level production seed/setup denial as defense in depth', () => {
    const middleware = source('middleware.ts')
    expect(middleware).toContain("pathname.startsWith('/api/seed/')")
    expect(middleware).toContain("pathname.startsWith('/setup') || pathname.startsWith('/api/industries/init')")
    expect(middleware).toContain("process.env.NODE_ENV === 'production'")
  })
})
