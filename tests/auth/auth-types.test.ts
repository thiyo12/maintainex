import { describe, it, expect } from 'vitest'
import { AuthError, type AuthErrorCode } from '../../lib/auth/errors'
import { TOKEN_PURPOSE, TOKEN_AUDIENCE, TOKEN_ISSUER, TOKEN_LIFETIMES } from '../../lib/auth/constants'
import type { MarketplacePrincipal, StaffPrincipal } from '../../lib/auth/types'

describe('auth types', () => {
  it('MarketplacePrincipal compiles with correct shape', () => {
    const p: MarketplacePrincipal = {
      principalType: 'MARKETPLACE_USER',
      userId: 'user-123',
      sessionId: 'session-456',
    }
    expect(p.principalType).toBe('MARKETPLACE_USER')
  })

  it('StaffPrincipal compiles with correct shape', () => {
    const p: StaffPrincipal = {
      principalType: 'STAFF',
      adminUserId: 'admin-789',
      sessionId: 'session-012',
    }
    expect(p.principalType).toBe('STAFF')
  })
})

describe('auth constants', () => {
  it('token purposes are distinct', () => {
    expect(TOKEN_PURPOSE.MARKETPLACE_ACCESS).not.toBe(TOKEN_PURPOSE.STAFF_ACCESS)
  })

  it('token audiences are distinct', () => {
    expect(TOKEN_AUDIENCE.MARKETPLACE).not.toBe(TOKEN_AUDIENCE.STAFF)
  })

  it('issuer is defined', () => {
    expect(TOKEN_ISSUER).toBe('maintainex')
  })

  it('lifetimes are defined', () => {
    expect(TOKEN_LIFETIMES.MARKETPLACE_ACCESS).toBe('15m')
    expect(TOKEN_LIFETIMES.STAFF_ACCESS).toBe('30m')
    expect(TOKEN_LIFETIMES.MARKETPLACE_REFRESH_DAYS).toBe(30)
    expect(TOKEN_LIFETIMES.STAFF_REFRESH_DAYS).toBe(7)
  })
})

describe('auth errors', () => {
  it('AuthError has correct status for AUTH_REQUIRED', () => {
    const err = new AuthError('AUTH_REQUIRED')
    expect(err.status).toBe(401)
    expect(err.message).toBe('Authentication required')
    expect(err.code).toBe('AUTH_REQUIRED')
    expect(err.name).toBe('AuthError')
  })

  it('AuthError has correct status for INVALID_CREDENTIALS', () => {
    const err = new AuthError('INVALID_CREDENTIALS')
    expect(err.status).toBe(401)
  })

  it('AuthError has correct status for FORBIDDEN', () => {
    const err = new AuthError('FORBIDDEN')
    expect(err.status).toBe(403)
  })

  it('AuthError has correct status for RATE_LIMITED', () => {
    const err = new AuthError('RATE_LIMITED')
    expect(err.status).toBe(429)
  })

  it('AuthError has correct status for LOCKED', () => {
    const err = new AuthError('LOCKED')
    expect(err.status).toBe(423)
  })

  it('AuthError toJSON returns code and message', () => {
    const err = new AuthError('SESSION_EXPIRED')
    expect(err.toJSON()).toEqual({ error: 'Session expired', code: 'SESSION_EXPIRED' })
  })

  it('AuthError is instance of Error', () => {
    const err = new AuthError('TOKEN_REPLAY')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AuthError)
  })
})
