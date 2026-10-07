import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { signMarketplaceAccessToken, verifyMarketplaceAccessToken } from '../../lib/auth/marketplace-jwt'
import { parseRefreshToken } from '../../lib/auth/refresh'
import { TOKEN_PURPOSE, TOKEN_AUDIENCE, TOKEN_ISSUER } from '../../lib/auth/constants'

const TEST_SECRET = 'test-marketplace-jwt-secret-that-is-long-enough-for-hs256'
const STAFF_SECRET = 'test-staff-jwt-secret-that-is-long-enough-for-hs256'
const ORIGINAL_SECRET = process.env.MARKETPLACE_JWT_SECRET
const ORIGINAL_STAFF = process.env.STAFF_JWT_SECRET

beforeAll(() => {
  process.env.MARKETPLACE_JWT_SECRET = TEST_SECRET
  process.env.STAFF_JWT_SECRET = STAFF_SECRET
})

afterAll(() => {
  if (ORIGINAL_SECRET !== undefined) process.env.MARKETPLACE_JWT_SECRET = ORIGINAL_SECRET
  else delete process.env.MARKETPLACE_JWT_SECRET
  if (ORIGINAL_STAFF !== undefined) process.env.STAFF_JWT_SECRET = ORIGINAL_STAFF
  else delete process.env.STAFF_JWT_SECRET
})

describe('Marketplace Access Token — Sign & Verify', () => {
  it('signs and verifies a valid token', () => {
    const token = signMarketplaceAccessToken('user-1', 'session-1')
    const claims = verifyMarketplaceAccessToken(token)
    expect(claims).not.toBeNull()
    expect(claims!.sub).toBe('user-1')
    expect(claims!.sid).toBe('session-1')
    expect(claims!.aud).toBe(TOKEN_AUDIENCE.MARKETPLACE)
    expect(claims!.iss).toBe(TOKEN_ISSUER)
    expect(claims!.type).toBe(TOKEN_PURPOSE.MARKETPLACE_ACCESS)
    expect(claims!.jti).toBeTruthy()
    expect(claims!.iat).toBeGreaterThan(0)
    expect(claims!.exp).toBeGreaterThan(claims!.iat)
  })

  it('rejects token with wrong audience', () => {
    const token = jwt.sign(
      { sub: 'u', sid: 's', aud: 'wrong-audience', iss: TOKEN_ISSUER, jti: 'x', type: TOKEN_PURPOSE.MARKETPLACE_ACCESS },
      TEST_SECRET,
      { expiresIn: '15m' }
    )
    expect(verifyMarketplaceAccessToken(token)).toBeNull()
  })

  it('rejects token with wrong issuer', () => {
    const token = jwt.sign(
      { sub: 'u', sid: 's', aud: TOKEN_AUDIENCE.MARKETPLACE, iss: 'wrong-issuer', jti: 'x', type: TOKEN_PURPOSE.MARKETPLACE_ACCESS },
      TEST_SECRET,
      { expiresIn: '15m' }
    )
    expect(verifyMarketplaceAccessToken(token)).toBeNull()
  })

  it('rejects token with wrong type', () => {
    const token = jwt.sign(
      { sub: 'u', sid: 's', aud: TOKEN_AUDIENCE.MARKETPLACE, iss: TOKEN_ISSUER, jti: 'x', type: 'staff_access' },
      TEST_SECRET,
      { expiresIn: '15m' }
    )
    expect(verifyMarketplaceAccessToken(token)).toBeNull()
  })

  it('rejects token with missing sid', () => {
    const token = jwt.sign(
      { sub: 'u', aud: TOKEN_AUDIENCE.MARKETPLACE, iss: TOKEN_ISSUER, jti: 'x', type: TOKEN_PURPOSE.MARKETPLACE_ACCESS },
      TEST_SECRET,
      { expiresIn: '15m' }
    )
    expect(verifyMarketplaceAccessToken(token)).toBeNull()
  })

  it('rejects token with missing sub', () => {
    const token = jwt.sign(
      { sid: 's', aud: TOKEN_AUDIENCE.MARKETPLACE, iss: TOKEN_ISSUER, jti: 'x', type: TOKEN_PURPOSE.MARKETPLACE_ACCESS },
      TEST_SECRET,
      { expiresIn: '15m' }
    )
    expect(verifyMarketplaceAccessToken(token)).toBeNull()
  })

  it('rejects expired token', () => {
    const token = jwt.sign(
      { sub: 'u', sid: 's', aud: TOKEN_AUDIENCE.MARKETPLACE, iss: TOKEN_ISSUER, jti: 'x', type: TOKEN_PURPOSE.MARKETPLACE_ACCESS },
      TEST_SECRET,
      { expiresIn: '-1s' }
    )
    expect(verifyMarketplaceAccessToken(token)).toBeNull()
  })

  it('rejects token signed with wrong secret', () => {
    const token = jwt.sign(
      { sub: 'u', sid: 's', aud: TOKEN_AUDIENCE.MARKETPLACE, iss: TOKEN_ISSUER, jti: 'x', type: TOKEN_PURPOSE.MARKETPLACE_ACCESS },
      'wrong-secret-that-is-long-enough',
      { expiresIn: '15m' }
    )
    expect(verifyMarketplaceAccessToken(token)).toBeNull()
  })

  it('rejects malformed token string', () => {
    expect(verifyMarketplaceAccessToken('not-a-jwt')).toBeNull()
    expect(verifyMarketplaceAccessToken('')).toBeNull()
    expect(verifyMarketplaceAccessToken('abc.def')).toBeNull()
  })

  it('rejects staff-purpose token signed with marketplace secret', () => {
    const token = jwt.sign(
      { sub: 'u', sid: 's', aud: TOKEN_AUDIENCE.STAFF, iss: TOKEN_ISSUER, jti: 'x', type: 'staff_access' },
      TEST_SECRET,
      { expiresIn: '30m' }
    )
    expect(verifyMarketplaceAccessToken(token)).toBeNull()
  })

  it('does not include email, role, or permissions in claims', () => {
    const token = signMarketplaceAccessToken('user-1', 'session-1')
    const decoded = jwt.decode(token) as Record<string, unknown>
    expect(decoded.email).toBeUndefined()
    expect(decoded.role).toBeUndefined()
    expect(decoded.permissions).toBeUndefined()
    expect(decoded.isActive).toBeUndefined()
  })

  it('uses MARKETPLACE_JWT_SECRET env var', () => {
    const token = signMarketplaceAccessToken('u', 's')
    const claims = verifyMarketplaceAccessToken(token)
    expect(claims).not.toBeNull()
  })
})

describe('Refresh Token — Malformed Input Tests', () => {
  it('parseRefreshToken rejects token without dot', () => {
    expect(parseRefreshToken('nodelimiterhere')).toBeNull()
  })

  it('parseRefreshToken rejects empty string', () => {
    expect(parseRefreshToken('')).toBeNull()
  })

  it('parseRefreshToken rejects token with empty session ID', () => {
    expect(parseRefreshToken('.some-secret-here')).toBeNull()
  })

  it('parseRefreshToken rejects token with short secret', () => {
    expect(parseRefreshToken('session-id.short')).toBeNull()
  })

  it('parseRefreshToken accepts valid format', () => {
    const secret = crypto.randomBytes(64).toString('hex')
    const result = parseRefreshToken(`sess-abc.${secret}`)
    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe('sess-abc')
    expect(result!.secret).toBe(secret)
  })

  it('parseRefreshToken rejects oversized token', () => {
    const huge = 'x.' + 'a'.repeat(10000)
    expect(parseRefreshToken(huge)).toBeNull()
  })

  it('parseRefreshToken requires the generated 128-character hex secret shape', () => {
    expect(parseRefreshToken('session-id.' + 'a'.repeat(127))).toBeNull()
    expect(parseRefreshToken('session-id.' + 'z'.repeat(128))).toBeNull()
    expect(parseRefreshToken('session.id.' + 'a'.repeat(128))).toBeNull()
  })

  it('parseRefreshToken rejects garbage input', () => {
    expect(parseRefreshToken('!!!@@@###')).toBeNull()
    expect(parseRefreshToken('a!b')).toBeNull()
  })
})
