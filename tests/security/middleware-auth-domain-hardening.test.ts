import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('middleware auth-domain hardening', () => {
  it('uses the canonical marketplace JWT secret for production marketplace API tokens', () => {
    const middleware = source('middleware.ts')

    expect(middleware).toContain('getMarketplaceJwtSecret')
    expect(middleware).toContain('MARKETPLACE_JWT_SECRET')
    expect(middleware).toContain("payload.aud !== 'maintainex-marketplace'")
    expect(middleware).toContain("payload.iss !== 'maintainex'")
    expect(middleware).toContain("payload.type !== 'marketplace_access'")
    expect(middleware).toContain('verifyMarketplaceToken(token)')
  })

  it('keeps legacy JWT verification reachable only outside production', () => {
    const middleware = source('middleware.ts')

    expect(middleware).toContain('verifyLegacyToken')
    expect(middleware).toContain("process.env.NODE_ENV !== 'production'")
    expect(middleware).not.toContain('async function verifySimpleToken')
  })

  it('keeps staff and marketplace signing domains independent', () => {
    const middleware = source('middleware.ts')

    expect(middleware).toContain('getMarketplaceJwtSecret()')
    expect(middleware).toContain('getStaffJwtSecret()')
    expect(middleware).toContain("payload.aud !== 'maintainex-staff'")
    expect(middleware).toContain("payload.type !== 'staff_access'")
  })

  it('does not treat role claims from canonical marketplace JWTs as authorization input', () => {
    const middleware = source('middleware.ts')
    const start = middleware.indexOf('async function verifyMarketplaceToken')
    const end = middleware.indexOf('async function verifyStaffToken', start)
    const verifier = middleware.slice(start, end)

    expect(verifier).not.toContain('payload.role')
    expect(verifier).not.toContain('payload.email')
    expect(verifier).toContain('payload.sub')
    expect(verifier).toContain('payload.sid')
  })

  it('only forwards a role header when a resolved compatibility session actually has a role', () => {
    const middleware = source('middleware.ts')
    expect(middleware).toContain("if ('role' in session && typeof session.role === 'string')")
  })

  it('canonical server auth resolver also rejects legacy tokens in production', () => {
    const authUtils = source('lib/auth/authentication/auth-utils.ts')
    expect(authUtils).toContain('authenticateMarketplaceUser(request)')
    expect(authUtils).toContain('resolveLiveStaffSession(token)')
    expect(authUtils).toContain("process.env.NODE_ENV !== 'production'")
  })
})
