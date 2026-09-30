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

  it('keeps every PayHere entry route on the shared trusted-origin resolver', () => {
    const routes = [
      'app/api/mobile/v2/jobs/[id]/payment/route.ts',
      'app/api/mobile/v2/jobs/[id]/pay/route.ts',
      'app/api/payments/payhere/[intentId]/route.ts',
    ]

    for (const route of routes) {
      const source = readFileSync(resolve(process.cwd(), route), 'utf-8')
      expect(source).toContain('resolvePaymentPublicOrigin(request.url)')
      expect(source).not.toContain('mutableEnv.NEXTAUTH_URL || new URL(request.url).origin')
    }
  })
})
