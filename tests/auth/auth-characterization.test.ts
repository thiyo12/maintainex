import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import {
  signAccessToken,
  signRefreshToken,
} from '../../lib/auth/authentication/admin-jwt'
import { verifySimpleToken, createSimpleToken, getAdminSession } from '../../lib/auth/authentication/admin-auth'
import { getSession } from '../../lib/auth/authentication/auth-utils'
import { assertNotSuspended, AuthenticatedUser } from '../../lib/auth/compatibility/mobile-auth'
import { ADMIN_ROLES, ROLE_PERMISSIONS } from '../../lib/auth/rbac/permissions'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// Characterization tests (Phase D): document CURRENT auth behavior only.
// These pin existing acceptance/rejection decisions and response shapes so
// future consolidation cannot silently change them.

const ORIGINAL_SECRET = process.env.JWT_SECRET
const ORIGINAL_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET
const TEST_SECRET = 'phase-d-auth-characterization-secret'

function hmacSign(data: string): string {
  return crypto.createHmac('sha256', TEST_SECRET).update(data).digest('hex')
}

function bearer(token: string): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

function cookieRequest(token: string): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    headers: { cookie: `admin_token=${token}` },
  })
}

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'SUPER_ADMIN' as const,
  firstName: 'Ada',
  lastName: 'Lovelace',
  assignedCountries: ['LK', 'CA'],
  sessionId: 'session-auth-characterization',
}

function user(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 'u-1',
    email: 'u@example.com',
    name: 'User One',
    phone: null,
    role: 'CUSTOMER',
    isActive: true,
    identityStatus: null,
    lastNameChangedAt: null,
    isSuspended: false,
    isBanned: false,
    suspendedUntil: null,
    suspensionReason: null,
    banReason: null,
    countryCode: 'LK',
    ...overrides,
  }
}

describe('Phase D — auth characterization (current behavior pinning)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET
    process.env.JWT_REFRESH_SECRET = 'phase-d-refresh-characterization-secret'
  })

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = ORIGINAL_SECRET
    if (ORIGINAL_REFRESH_SECRET === undefined) delete process.env.JWT_REFRESH_SECRET
    else process.env.JWT_REFRESH_SECRET = ORIGINAL_REFRESH_SECRET
  })

  describe('verifySimpleToken — 3-part JWT branch', () => {
    it('accepts a signed admin access token and normalizes the payload', () => {
      const token = signAccessToken(adminUser)
      const payload = verifySimpleToken(token)
      expect(payload).toBeTruthy()
      expect(payload.id).toBe('admin-1')
      expect(payload.email).toBe('admin@example.com')
      expect(payload.role).toBe('SUPER_ADMIN')
      expect(payload.name).toBe('Ada Lovelace')
      expect(payload.branchId).toBeNull()
      expect(payload.province).toBeNull()
      expect(payload.region).toBeNull()
      expect(payload.canEditServices).toBe(false)
      expect(payload.authType).toBe('admin')
    })

    it('rejects a token with a tampered signature', () => {
      const token = signAccessToken(adminUser)
      const parts = token.split('.')
      const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}${parts[2].slice(-2) === 'aa' ? 'bb' : 'aa'}`
      expect(verifySimpleToken(tampered)).toBeNull()
    })

    it('does not enforce a type claim (any HS256 JWT signed with JWT_SECRET verifies)', () => {
      // Signed with JWT_SECRET but type:'refresh' — verifySimpleToken has no type filter.
      const sameSecretRefresh = jwt.sign(
        { sub: 'admin-1', jti: 'jti-1', type: 'refresh' },
        TEST_SECRET,
        { expiresIn: '1h' }
      )
      const payload = verifySimpleToken(sameSecretRefresh)
      expect(payload).toBeTruthy()
      expect(payload.id).toBe('admin-1')
    })

    it('rejects the real refresh token (signed with JWT_REFRESH_SECRET)', () => {
      expect(verifySimpleToken(signRefreshToken('admin-1', 'jti-x'))).toBeNull()
    })
  })

  describe('verifySimpleToken — 2-part legacy branch (HMAC-hex scheme)', () => {
    it('round-trips a createSimpleToken token', () => {
      const token = createSimpleToken({ id: 'legacy-1', email: 'l@example.com', role: 'MANAGER' })
      expect(token.split('.')).toHaveLength(2)
      const payload = verifySimpleToken(token)
      expect(payload).toBeTruthy()
      expect(payload.id).toBe('legacy-1')
      expect(payload.role).toBe('MANAGER')
      expect(typeof payload.created).toBe('number')
    })

    it('accepts a manually built HMAC-hex legacy token (documents the signature scheme)', () => {
      const payloadObj = { id: 'legacy-2', email: 'x@example.com', role: 'SUPPORT', created: Date.now() }
      const encoded = Buffer.from(JSON.stringify(payloadObj)).toString('base64')
      const token = `${encoded}.${hmacSign(encoded)}`
      const payload = verifySimpleToken(token)
      expect(payload).toBeTruthy()
      expect(payload.id).toBe('legacy-2')
    })

    it('rejects a legacy token with the wrong signature scheme (base64(secret+payload) style)', () => {
      const payloadObj = { id: 'legacy-3', created: Date.now() }
      const encoded = Buffer.from(JSON.stringify(payloadObj)).toString('base64')
      const wrongSig = Buffer.from(TEST_SECRET + encoded).toString('base64').slice(0, 32)
      expect(verifySimpleToken(`${encoded}.${wrongSig}`)).toBeNull()
    })

    it('rejects a legacy token older than 30 days', () => {
      const now = Date.now()
      const payloadObj = { id: 'legacy-4', created: now - 31 * 24 * 60 * 60 * 1000 }
      const encoded = Buffer.from(JSON.stringify(payloadObj)).toString('base64')
      const token = `${encoded}.${hmacSign(encoded)}`
      expect(verifySimpleToken(token)).toBeNull()
    })
  })

  describe('getAdminSession', () => {
    it('resolves a bearer admin access JWT (with assignedCountries)', async () => {
      const session = await getAdminSession(bearer(signAccessToken(adminUser)))
      expect(session).toBeTruthy()
      expect(session.sub).toBe('admin-1')
      expect(session.role).toBe('SUPER_ADMIN')
      expect(session.assignedCountries).toEqual(['LK', 'CA'])
      expect(session.type).toBe('access')
    })

    it('falls back to the admin_token cookie when no bearer is present', async () => {
      const session = await getAdminSession(cookieRequest(signAccessToken(adminUser)))
      expect(session).toBeTruthy()
      expect(session.role).toBe('SUPER_ADMIN')
    })

    it('returns null with no credentials', async () => {
      const session = await getAdminSession(new NextRequest('http://localhost/api/test'))
      expect(session).toBeNull()
    })

    it('falls a same-secret non-access JWT through the simple-token fallback without a role (current quirk)', async () => {
      const sameSecretRefresh = jwt.sign(
        { sub: 'admin-1', jti: 'jti-2', type: 'refresh' },
        TEST_SECRET,
        { expiresIn: '1h' }
      )
      const session = await getAdminSession(bearer(sameSecretRefresh))
      expect(session).toBeTruthy()
      expect(session.id).toBe('admin-1')
      expect(session.role).toBeUndefined()
    })

    it('rejects the real refresh token (different secret + type check)', async () => {
      const session = await getAdminSession(bearer(signRefreshToken('admin-1', 'jti-3')))
      expect(session).toBeNull()
    })
  })

  describe('auth-utils getSession (website session shape)', () => {
    it('returns the SessionUser shape from a bearer token (no authType/assignedCountries fields)', async () => {
      const session = await getSession(bearer(signAccessToken(adminUser)))
      expect(session).toBeTruthy()
      expect(Object.keys(session!).sort()).toEqual(
        ['branchId', 'canEditServices', 'email', 'id', 'name', 'province', 'region', 'role'].sort()
      )
      expect(session!.id).toBe('admin-1')
      expect(session!.name).toBe('Ada Lovelace')
    })

    it('falls back to the admin_token cookie', async () => {
      const session = await getSession(cookieRequest(signAccessToken(adminUser)))
      expect(session).toBeTruthy()
      expect(session!.role).toBe('SUPER_ADMIN')
    })

    it('returns null when no credentials exist', async () => {
      const session = await getSession(new NextRequest('http://localhost/api/test'))
      expect(session).toBeNull()
    })

    it('returns null when the bearer token fails verification', async () => {
      const session = await getSession(bearer('not-a-token'))
      expect(session).toBeNull()
    })
  })

  describe('assertNotSuspended', () => {
    it('rejects banned accounts with 403 BANNED', () => {
      const res = assertNotSuspended(user({ isBanned: true, banReason: 'bad actor' }))
      expect(res).toBeTruthy()
      expect(res!.status).toBe(403)
    })

    it('rejects indefinite suspensions with 403 SUSPENDED', () => {
      const res = assertNotSuspended(user({ isSuspended: true, suspendedUntil: null }))
      expect(res).toBeTruthy()
      expect(res!.status).toBe(403)
    })

    it('rejects active temporary suspensions with suspendedUntil in the payload', () => {
      const until = new Date(Date.now() + 60_000)
      const res = assertNotSuspended(user({ isSuspended: true, suspendedUntil: until }))
      expect(res).toBeTruthy()
      expect(res!.status).toBe(403)
    })

    it('allows users whose temporary suspension has expired', () => {
      const res = assertNotSuspended(
        user({ isSuspended: true, suspendedUntil: new Date(Date.now() - 60_000) })
      )
      expect(res).toBeNull()
    })

    it('allows healthy users', () => {
      expect(assertNotSuspended(user({}))).toBeNull()
    })
  })

  describe('role + permission vocabulary parity', () => {
    it('ADMIN_ROLES keys match the six admin roles the middleware allowlist admits', () => {
      expect(Object.keys(ADMIN_ROLES).sort()).toEqual(
        ['FINANCE', 'MANAGER', 'SUPPORT', 'SUPER_ADMIN', 'TECHNICAL', 'USER_MANAGEMENT'].sort()
      )
    })

    it('ROLE_PERMISSIONS covers exactly the same roles as ADMIN_ROLES', () => {
      expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(Object.keys(ADMIN_ROLES).sort())
    })

    it('only SUPER_ADMIN holds the most privileged permission set (spot pin)', () => {
      expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain('admins:delete')
      expect(ROLE_PERMISSIONS.TECHNICAL).not.toContain('admins:delete')
      expect(ROLE_PERMISSIONS.FINANCE).toContain('commission:manage')
    })
  })
})
