import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { resolvePaymentPublicOrigin } from '@/lib/finance/payments/public-origin'

const mutableEnv = process.env as Record<string, string | undefined>
const originalNodeEnv = mutableEnv.NODE_ENV
const originalNextAuthUrl = mutableEnv.NEXTAUTH_URL

afterEach(() => {
  if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV
  else mutableEnv.NODE_ENV = originalNodeEnv

  if (originalNextAuthUrl === undefined) delete mutableEnv.NEXTAUTH_URL
  else mutableEnv.NEXTAUTH_URL = originalNextAuthUrl
})

describe('trusted payment public origin', () => {
  it('uses configured NEXTAUTH_URL origin', () => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.NEXTAUTH_URL = 'https://maintainex.lk/some/path'
    expect(resolvePaymentPublicOrigin('https://attacker.example/pay')).toBe('https://maintainex.lk')
  })

  it('fails closed in production when NEXTAUTH_URL is missing', () => {
    mutableEnv.NODE_ENV = 'production'
    delete mutableEnv.NEXTAUTH_URL
    expect(resolvePaymentPublicOrigin('https://attacker.example/pay')).toBeNull()
  })

  it('allows request-origin fallback only outside production', () => {
    mutableEnv.NODE_ENV = 'test'
    delete mutableEnv.NEXTAUTH_URL
    expect(resolvePaymentPublicOrigin('http://localhost:3000/api/pay')).toBe('http://localhost:3000')
  })

  it('requires HTTPS for the configured production payment origin', () => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.NEXTAUTH_URL = 'http://maintainex.lk'
    expect(resolvePaymentPublicOrigin('https://maintainex.lk/api/pay')).toBeNull()
  })

  it('fails closed for an invalid configured URL', () => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.NEXTAUTH_URL = 'not-a-url'
    expect(resolvePaymentPublicOrigin('https://maintainex.lk/api/pay')).toBeNull()
  })

  it('keeps every payment entry route on the shared trusted-origin resolver', () => {
    const routes = [
      'app/api/mobile/v2/jobs/[id]/payment/route.ts',
      'app/api/mobile/v2/jobs/[id]/pay/route.ts',
    ]

    for (const route of routes) {
      const source = readFileSync(resolve(process.cwd(), route), 'utf-8')
      expect(source).toContain('resolvePaymentPublicOrigin(request.url)')
      expect(source).not.toContain('mutableEnv.NEXTAUTH_URL || new URL(request.url).origin')
    }
  })

  it('never derives an HTTP checkout origin from a PayPal browser return route', () => {
    // The PayPal return/cancel pages only emit a maintainex:// deep link, so
    // they must never resolve an HTTP origin from the incoming request.
    for (const route of [
      'app/api/payments/paypal/return/route.ts',
      'app/api/payments/paypal/cancel/route.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), route), 'utf-8')
      expect(source).not.toContain('resolvePaymentPublicOrigin')
      expect(source).not.toContain('new URL(request.url).origin')
    }
  })

  it('never derives a checkout origin from the legacy PayHere route', () => {
    // The PayHere route is now a fail-closed 410 that renders no payment form,
    // so it must not resolve or build any checkout origin at all.
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/payments/payhere/[intentId]/route.ts'),
      'utf-8'
    )
    expect(source).not.toContain('resolvePaymentPublicOrigin')
    expect(source).not.toContain('request.url')
    expect(source).toContain('status: 410')
  })
})
