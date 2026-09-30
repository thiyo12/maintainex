import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  matchesRefreshTokenHash,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/lib/auth/authentication/admin-jwt'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('admin session-bound token lifecycle', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-admin-access-secret-that-is-long-enough'
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'test-admin-refresh-secret-that-is-long-enough'
  })

  it('binds access tokens to the live admin session id', () => {
    const token = signAccessToken({
      id: 'admin-1',
      email: 'admin@example.test',
      role: 'SUPER_ADMIN',
      firstName: 'Admin',
      lastName: 'One',
      assignedCountries: ['LK'],
      sessionId: 'session-1',
    })

    expect(verifyAccessToken(token)).toMatchObject({
      sub: 'admin-1',
      sid: 'session-1',
      type: 'access',
    })
  })

  it('makes refresh tokens unique and validates the stored token hash', () => {
    const first = signRefreshToken('admin-1', 'session-1')
    const second = signRefreshToken('admin-1', 'session-1')

    expect(first).not.toBe(second)
    expect(verifyRefreshToken(first)).toMatchObject({
      sub: 'admin-1',
      jti: 'session-1',
      type: 'refresh',
    })
    expect(matchesRefreshTokenHash(first, hashRefreshToken(first))).toBe(true)
    expect(matchesRefreshTokenHash(first, hashRefreshToken(second))).toBe(false)
  })

  it('persists the actual refresh JWT hash after password and 2FA login', () => {
    const passwordLogin = read('app/api/admin/auth/login/route.ts')
    const twoFactorLogin = read('app/api/admin/auth/2fa/verify/route.ts')

    expect(passwordLogin).toContain('refreshTokenHash: hashRefreshToken(refreshToken)')
    expect(twoFactorLogin).toContain('refreshTokenHash: hashRefreshToken(refreshToken)')
    expect(twoFactorLogin).toContain('sessionId: session.id')
    expect(twoFactorLogin).toContain("response.cookies.set('admin_token', accessToken")
  })

  it('atomically rotates refresh state and renews a session-bound access cookie', () => {
    const refresh = read('app/api/admin/auth/refresh/route.ts')

    expect(refresh).toContain('matchesRefreshTokenHash(refreshToken, session.refreshTokenHash)')
    expect(refresh).toContain('refreshTokenHash: session.refreshTokenHash')
    expect(refresh).toContain('refreshTokenHash: newRefreshTokenHash')
    expect(refresh).toContain('if (rotated.count !== 1)')
    expect(refresh).toContain('sessionId: session.id')
    expect(refresh).toContain("response.cookies.set('admin_token', accessToken")
  })

  it('requires the live CRM session guard before mutating 2FA setup', () => {
    const setup = read('app/api/admin/auth/2fa/setup/route.ts')
    expect(setup).toContain("guardCrmRequest(request, { level: 'sensitive' })")
    expect(setup).not.toContain('verifyAccessToken(authHeader.slice(7))')
  })

  it('resolves the CRM shell identity from live session state instead of stale JWT claims', () => {
    const me = read('app/api/admin/auth/me/route.ts')
    expect(me).toContain("guardCrmRequest(request, { level: 'read' })")
    expect(me).toContain('where: { id: guard.context.adminId }')
    expect(me).not.toContain("getAdminSession(request)")
  })

  it('requires a session-bound claim before rendering protected admin pages', () => {
    const middleware = read('middleware.ts')
    expect(middleware).toContain('sessionId: payload.sid || payload.sessionId || null')
    expect(middleware).toContain('if (!session.sessionId)')
    expect(middleware).toContain("'/admin/login?error=session_required'")
  })
})
