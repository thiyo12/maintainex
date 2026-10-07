import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { signStaffAccessToken, verifyStaffAccessToken } from '@/lib/auth/staff-jwt'
import {
  generateStaffRefreshToken,
  parseStaffRefreshToken,
  verifyStaffRefreshSecret,
} from '@/lib/auth/staff-rotation'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('canonical staff session/token lifecycle', () => {
  beforeAll(() => {
    process.env.STAFF_JWT_SECRET =
      process.env.STAFF_JWT_SECRET || 'test-staff-session-secret-012345678901234567890123'
  })

  it('binds minimal staff access tokens to a session and dedicated audience', () => {
    const token = signStaffAccessToken('admin-1', 'session-1')
    const claims = verifyStaffAccessToken(token)

    expect(claims).toMatchObject({
      sub: 'admin-1',
      sid: 'session-1',
      aud: 'maintainex-staff',
      iss: 'maintainex',
      type: 'staff_access',
    })
    expect((claims as any).role).toBeUndefined()
    expect((claims as any).email).toBeUndefined()
    expect((claims as any).permissions).toBeUndefined()
  })

  it('resolves the canonical staff token from the admin cookie', async () => {
    const token = signStaffAccessToken('admin-cookie', 'session-cookie')
    const session = await getAdminSession({
      headers: { get: () => null },
      cookies: {
        get: (name: string) => name === 'admin_token' ? { value: token } : undefined,
      },
    })

    expect(session).toMatchObject({
      sub: 'admin-cookie',
      sid: 'session-cookie',
      type: 'staff_access',
    })
  })

  it('uses opaque refresh secrets whose stored form is one-way hashed', () => {
    const first = generateStaffRefreshToken()
    const second = generateStaffRefreshToken()

    expect(first.raw).not.toBe(second.raw)
    expect(first.raw).toMatch(/^[0-9a-f]{128}$/)
    expect(first.secretHash).toMatch(/^[0-9a-f]{64}$/)
    expect(verifyStaffRefreshSecret(first.raw, first.secretHash)).toBe(true)
    expect(verifyStaffRefreshSecret(second.raw, first.secretHash)).toBe(false)

    const parsed = parseStaffRefreshToken(`session-1.${first.raw}`)
    expect(parsed).toEqual({ sessionId: 'session-1', secret: first.raw })
  })

  it('creates sessions through the canonical staff session service after password and 2FA login', () => {
    const passwordLogin = read('app/api/admin/auth/login/route.ts')
    const twoFactorLogin = read('app/api/admin/auth/2fa/verify/route.ts')

    for (const source of [passwordLogin, twoFactorLogin]) {
      expect(source).toContain('createStaffSession')
      expect(source).toContain('staffSession.accessToken')
      expect(source).toContain('staffSession.refreshTokenRaw')
      expect(source).toContain("response.cookies.set('admin_token', accessToken")
      expect(source).toContain('maxAge: 30 * 60')
      expect(source).not.toContain("from '@/lib/auth/authentication/admin-jwt'")
    }
  })

  it('rotates opaque refresh secrets atomically and detects token-family replay', () => {
    const rotation = read('lib/auth/staff-rotation.ts')
    const refresh = read('app/api/admin/auth/refresh/route.ts')

    expect(refresh).toContain('rotateStaffRefreshToken')
    expect(rotation).toContain('verifyStaffRefreshSecret')
    expect(rotation).toContain('refreshTokenHash: session.refreshTokenHash')
    expect(rotation).toContain('tokenFamilyId: familyId')
    expect(rotation).toContain('updated.count === 0')
    expect(rotation).toContain("action: 'STAFF_TOKEN_REPLAY'")
    expect(rotation).toContain('isRevoked: true')
  })

  it('uses STAFF_JWT_SECRET for MFA temporary tokens with a distinct audience and purpose', () => {
    const passwordLogin = read('app/api/admin/auth/login/route.ts')
    const twoFactorLogin = read('app/api/admin/auth/2fa/verify/route.ts')

    expect(passwordLogin).toContain('process.env.STAFF_JWT_SECRET')
    expect(passwordLogin).toContain("audience: 'maintainex-staff-mfa'")
    expect(passwordLogin).toContain("type: 'staff_mfa'")
    expect(twoFactorLogin).toContain('process.env.STAFF_JWT_SECRET')
    expect(twoFactorLogin).toContain("audience: 'maintainex-staff-mfa'")
    expect(twoFactorLogin).toContain("(tempPayload as any).type !== 'staff_mfa'")
  })

  it('revokes the canonical staff session and clears both cookies during logout', () => {
    const logout = read('app/api/admin/auth/logout/route.ts')
    expect(logout).toContain('parseStaffRefreshToken')
    expect(logout).toContain('revokeStaffSession(parsed.sessionId)')
    expect(logout).toContain("response.cookies.set('admin_token', ''")
    expect(logout).toContain("response.cookies.set('refresh_token', ''")
    expect(logout).toContain('clearAdminCookies(response)')
  })

  it('requires staff-token cryptography in production CRM authentication', () => {
    const auth = read('lib/auth/authentication/admin-auth.ts')
    const middleware = read('middleware.ts')

    expect(auth).toContain('verifyStaffAccessToken')
    expect(auth).toContain("process.env.NODE_ENV !== 'production'")
    expect(auth).toContain('Production')
    expect(middleware).toContain('getStaffJwtSecret')
    expect(middleware).toContain("payload.aud !== 'maintainex-staff'")
    expect(middleware).toContain("payload.type !== 'staff_access'")
    expect(middleware).toContain('getStaffSession(request)')
  })

  it('keeps live role, country and permission decisions outside access-token claims', () => {
    const crm = read('lib/crm/security.ts')
    expect(crm).toContain('prisma.adminUser.findUnique')
    expect(crm).toContain('prisma.adminSession.findUnique')
    expect(crm).toContain('permissionOverrides')
    expect(crm).toContain('assignedCountries')
    expect(crm).toContain('CRM_SESSION_REVOKED')
  })
})
