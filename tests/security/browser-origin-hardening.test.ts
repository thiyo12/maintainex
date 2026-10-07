import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const originalEnv = { ...process.env }
const strong = (label: string) => `${label}-0123456789abcdef0123456789abcdef0123456789abcdef`

function baseProductionEnv() {
  ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
  process.env.MARKETPLACE_JWT_SECRET = strong('marketplace')
  process.env.STAFF_JWT_SECRET = strong('staff')
  process.env.JWT_SECRET = strong('legacy')
  process.env.PASSWORD_PEPPER = strong('password')
  process.env.IDENTITY_CLAIM_PEPPER = strong('identity')
  process.env.INTERNAL_SYNC_SECRET = strong('sync')
  process.env.CRON_SECRET = strong('cron')
  process.env.ALLOW_TEST_OTP = 'false'
  process.env.APP_RELEASE_SHA = '0123456789abcdef0123456789abcdef01234567'
  process.env.TRUSTED_PROXY_MODE = 'cloudflare'
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

describe('browser and CORS production boundaries', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    baseProductionEnv()
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('does not default mobile API CORS to wildcard in production', () => {
    const middleware = source('middleware.ts')
    expect(middleware).toContain("const configuredMobileOrigin = process.env.MOBILE_CORS_ORIGIN?.trim()")
    expect(middleware).toContain("else if (process.env.NODE_ENV !== 'production')")
    expect(middleware).not.toContain("process.env.MOBILE_CORS_ORIGIN || '*'")
  })

  it('adds Vary: Origin when a mobile browser origin is explicitly configured', () => {
    const middleware = source('middleware.ts')
    expect(middleware).toContain("response.headers.set('Access-Control-Allow-Origin', configuredMobileOrigin)")
    expect(middleware).toContain("response.headers.set('Vary', 'Origin')")
  })

  it('rejects wildcard mobile browser CORS in production startup validation', async () => {
    process.env.MOBILE_CORS_ORIGIN = '*'
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')
    const result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('[CRITICAL] MOBILE_CORS_ORIGIN must not be wildcard in production')
  })

  it('rejects non-HTTPS or path-bearing mobile browser origins in production', async () => {
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')

    process.env.MOBILE_CORS_ORIGIN = 'http://app.example.com'
    let result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('[CRITICAL] MOBILE_CORS_ORIGIN must be a single HTTPS origin in production')

    process.env.MOBILE_CORS_ORIGIN = 'https://app.example.com/path'
    result = validateRequiredSecrets()
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('[CRITICAL] MOBILE_CORS_ORIGIN must be a single HTTPS origin in production')
  })

  it('accepts a single explicit HTTPS mobile browser origin', async () => {
    process.env.MOBILE_CORS_ORIGIN = 'https://app.maintainex.lk'
    const { validateRequiredSecrets } = await import('@/lib/config/env-validation')
    expect(validateRequiredSecrets()).toEqual({ valid: true, errors: [] })
  })

  it('keeps security headers on early middleware denial paths', () => {
    const middleware = source('middleware.ts')

    expect(middleware).toContain("return applySecurityHeaders(applyRequestId(new NextResponse(\n      JSON.stringify({ error: 'Access denied', code: 'IP_BLOCKED' })")
    expect(
      (middleware.match(/applySecurityHeaders\(applyRequestId\(new NextResponse\([\s\S]*?Rate limit exceeded\. Try again later\./g) || []).length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      (middleware.match(/applySecurityHeaders\(applyRequestId\(new NextResponse\([\s\S]*?Not available in production/g) || []).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('keeps CRM state-changing requests behind origin-aware guardCrmRequest', () => {
    const crm = source('lib/crm/security.ts')
    expect(crm).toContain('trustedRequestOrigins')
    expect(crm).toContain('isTrustedCrmMutationRequest')
    expect(crm).toContain('sec-fetch-site')
    expect(crm).toContain('x-forwarded-proto')
    expect(crm).toContain("'CRM_ORIGIN_REJECTED'")
  })
})
