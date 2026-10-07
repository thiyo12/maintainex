import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import jwt from 'jsonwebtoken'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const SECRET = 'test-staff-jwt-secret-value-with-enough-entropy-0123456789'

beforeAll(() => {
  process.env.STAFF_JWT_SECRET = SECRET
})
afterAll(() => {
  delete process.env.STAFF_JWT_SECRET
})

async function loadEnrollmentModule() {
  return import('@/lib/auth/staff-mfa-enrollment')
}

const ENROLL_AUD = 'maintainex-staff-mfa-enrollment'
const MFA_AUD = 'maintainex-staff-mfa'

describe('enrollment token issuance and verification', () => {
  it('1. issues an enrollment token scoped only for first enrollment', async () => {
    const { issueStaffMfaEnrollmentToken, verifyStaffMfaEnrollmentToken } =
      await loadEnrollmentModule()

    const token = issueStaffMfaEnrollmentToken({
      adminUserId: 'admin-1',
      email: 'owner@example.com',
    })

    const claims = verifyStaffMfaEnrollmentToken(token)
    expect(claims).not.toBeNull()
    expect(claims?.sub).toBe('admin-1')

    const decoded = jwt.decode(token) as Record<string, unknown>
    expect(decoded.purpose).toBe('2fa_enroll')
    expect(decoded.type).toBe('staff_mfa_enrollment')
    expect(decoded.aud).toBe(ENROLL_AUD)
    expect(decoded.iss).toBe('maintainex')
    // No session id: it can never be exchanged for an AdminSession.
    expect(decoded.sid).toBeUndefined()
    expect(decoded.sessionId).toBeUndefined()

    // Max 5 minute lifetime.
    const ttl = Number(decoded.exp) - Number(decoded.iat)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(5 * 60)
  })

  it('2. cannot be accepted as a normal staff access token', async () => {
    const { issueStaffMfaEnrollmentToken } = await loadEnrollmentModule()
    const { verifyStaffAccessToken } = await import('@/lib/auth/staff-jwt')

    const token = issueStaffMfaEnrollmentToken({
      adminUserId: 'admin-1',
      email: 'owner@example.com',
    })
    expect(verifyStaffAccessToken(token)).toBeNull()
  })

  it('3. rejects a wrong or malformed token', async () => {
    const { verifyStaffMfaEnrollmentToken } = await loadEnrollmentModule()
    expect(verifyStaffMfaEnrollmentToken(null)).toBeNull()
    expect(verifyStaffMfaEnrollmentToken('')).toBeNull()
    expect(verifyStaffMfaEnrollmentToken('not-a-token')).toBeNull()
  })

  it('4. rejects an expired token', async () => {
    const { verifyStaffMfaEnrollmentToken } = await loadEnrollmentModule()
    const expired = jwt.sign(
      {
        sub: 'admin-1',
        email: 'owner@example.com',
        purpose: '2fa_enroll',
        type: 'staff_mfa_enrollment',
      },
      SECRET,
      { expiresIn: '-1m', audience: ENROLL_AUD, issuer: 'maintainex' }
    )
    expect(verifyStaffMfaEnrollmentToken(expired)).toBeNull()
  })

  it('5. cannot be used as a 2fa_verify token', () => {
    const verify = source('app/api/admin/auth/2fa/verify/route.ts')
    // verify route pins the 2fa audience + purpose/type
    expect(verify).toContain("audience: 'maintainex-staff-mfa'")
    expect(verify).toContain("tempPayload.purpose !== '2fa_verify'")
    expect(verify).toContain("(tempPayload as any).type !== 'staff_mfa'")
    expect(verify).not.toContain('maintainex-staff-mfa-enrollment')
  })

  it('5b. a 2fa_verify token is not accepted as an enrollment token', async () => {
    const { verifyStaffMfaEnrollmentToken } = await loadEnrollmentModule()
    const mfaToken = jwt.sign(
      { sub: 'admin-1', purpose: '2fa_verify', type: 'staff_mfa' },
      SECRET,
      { expiresIn: '5m', audience: MFA_AUD, issuer: 'maintainex' }
    )
    expect(verifyStaffMfaEnrollmentToken(mfaToken)).toBeNull()
  })
})

describe('login issues an enrollment token instead of a CRM session', () => {
  const login = source('app/api/admin/auth/login/route.ts')

  it('does not dead-end the first super-admin sign-in', () => {
    expect(login).toContain('requiresMfaEnrollment: true')
    expect(login).toContain('issueStaffMfaEnrollmentToken')
    expect(login).toContain('enrollmentToken,')
  })

  it('never returns access/refresh tokens on the enrollment path', () => {
    const enrollmentBranch = login.slice(
      login.indexOf('requiresMfaEnrollment: true') - 900,
      login.indexOf('requiresMfaEnrollment: true') + 200
    )
    expect(enrollmentBranch).not.toContain('createStaffSession')
    expect(enrollmentBranch).not.toContain('accessToken')
    expect(enrollmentBranch).not.toContain('refreshToken')
    expect(enrollmentBranch).not.toContain('admin_token')
    expect(login).toContain("headers: { 'Cache-Control': 'no-store' }")
  })

  it('enrolled super-admins keep the existing 2fa_verify flow', () => {
    expect(login).toContain("purpose: '2fa_verify'")
    expect(login).toContain("audience: 'maintainex-staff-mfa'")
    expect(login).toContain('if (adminUser.totpEnabled && adminUser.totpSecret)')
  })
})

describe('enrollment endpoints re-verify live state', () => {
  const setup = source('app/api/admin/auth/2fa/setup/route.ts')
  const confirm = source('app/api/admin/auth/2fa/confirm/route.ts')

  it('6. setup requires a matching live super-admin account', () => {
    expect(setup).toContain('verifyStaffMfaEnrollmentToken(enrollmentToken)')
    expect(setup).toContain('resolveEnrollmentSubject')
    // live state gate lives in the shared helper
    const helper = source('lib/auth/staff-mfa-enrollment.ts')
    expect(helper).toContain("adminUser.role !== 'SUPER_ADMIN'")
    expect(helper).toContain('lockedUntil')
    expect(helper).toContain('deletedAt')
    expect(helper).toContain('isActive')
  })

  it('a supplied-but-invalid token never falls back to a session', () => {
    expect(setup).toContain('Invalid or expired enrollment token')
    expect(confirm).toContain('Invalid or expired enrollment token')
  })

  it('setup rechecks the current password and never logs the secret', () => {
    expect(setup).toContain('verifyPasswordWithMigration')
    expect(setup).toContain('Current password is required')
    expect(setup).not.toMatch(/logger\.[a-z]+\([^)]*secret/i)
  })

  it('7/8. confirm requires a real 6-digit TOTP and sets verified state', () => {
    expect(confirm).toContain('/^\\d{6}$/')
    expect(confirm).toContain('verifyTotp(totpCode, adminUser.totpSecret)')
    expect(confirm).toContain('totpEnabled: true')
    expect(confirm).toContain('totpVerifiedAt: now')
    expect(confirm).toContain("action: '2FA_ENABLED'")
  })

  it('requires a stored secret before confirming', () => {
    expect(confirm).toContain('Start two-factor setup before confirming it.')
  })

  it('9/10. confirmation creates no session and returns no tokens', () => {
    expect(confirm).not.toContain('createStaffSession')
    expect(confirm).not.toContain('accessToken')
    expect(confirm).not.toContain('refreshToken')
    expect(confirm).not.toContain('admin_token')
    // session revocation only runs for a real session
    expect(confirm).toContain('if (security.sessionId) {')
  })
})

describe('enrollment UI keeps secrets out of storage', () => {
  const page = source('app/(auth)/admin/login/page.tsx')

  it('enters enrollment in place and returns to login afterwards', () => {
    expect(page).toContain('mpData.requiresMfaEnrollment')
    expect(page).toContain("setStep('enroll')")
    expect(page).toContain('Two-factor authentication enabled successfully. Please sign in again.')
    expect(page).toContain("window.location.href = '/admin/login'")
  })

  it('clears enrollment material from memory', () => {
    expect(page).toContain('clearEnrollment')
    expect(page).toMatch(/clearEnrollment\(\)[\s\S]{0,80}setEnrollmentToken\(''\)/)
  })

  it('never persists enrollment material in browser storage', () => {
    expect(page).not.toContain('localStorage.setItem')
    expect(page).not.toContain('sessionStorage.setItem')
    expect(page).not.toContain('document.cookie')
  })

  it('renders the QR locally and offers a manual key', () => {
    expect(page).toContain("await import('qrcode')")
    expect(page).toContain('Manual setup key')
  })
})

describe('MFA enforcement is not weakened', () => {
  it('CRM guard still requires totpEnabled for super-admin', () => {
    const guard = source('lib/crm/security.ts')
    expect(guard).toContain('CRM_MFA_REQUIRED')
    expect(guard).toContain("role === 'SUPER_ADMIN'")
    expect(guard).toContain('liveAdmin.totpEnabled === false')
  })

  it('the enrollment token is never accepted by CRM APIs', () => {
    const guard = source('lib/crm/security.ts')
    expect(guard).not.toContain('staff_mfa_enrollment')
    expect(guard).not.toContain('2fa_enroll')
    const staffJwt = source('lib/auth/staff-jwt.ts')
    expect(staffJwt).not.toContain('staff_mfa_enrollment')
  })

  it('no route enables MFA by direct flag write without a verified code', () => {
    const confirm = source('app/api/admin/auth/2fa/confirm/route.ts')
    const setup = source('app/api/admin/auth/2fa/setup/route.ts')
    // setup must keep totpEnabled false; only a verified code may enable it
    expect(setup).toContain('totpEnabled: false')
    expect(confirm).toContain('verifyTotp')
    const schema = source('prisma/schema.prisma')
    expect(schema).toContain('model AdminUser')
  })
})