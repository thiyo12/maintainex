import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('mandatory super-admin MFA', () => {
  it('never grants CRM access to an unenrolled SUPER_ADMIN at login', () => {
    const login = source('app/api/admin/auth/login/route.ts')
    expect(login).toContain("adminUser.role === 'SUPER_ADMIN'")
    expect(login).toContain('!adminUser.totpEnabled || !adminUser.totpSecret')
    expect(login).toContain("failureReason: 'MFA_ENROLLMENT_REQUIRED'")

    // The unenrolled super-admin is routed into first-time enrollment with a
    // short-lived, enrollment-only token. It must never become a CRM session,
    // access token or refresh token.
    expect(login).toContain('requiresMfaEnrollment: true')
    const branch = login.slice(
      login.indexOf('requiresMfaEnrollment: true') - 900,
      login.indexOf('requiresMfaEnrollment: true') + 200
    )
    expect(branch).not.toContain('createStaffSession')
    expect(branch).not.toContain('accessToken')
    expect(branch).not.toContain('refreshToken')
    expect(branch).not.toContain('admin_token')

    // Enrollment can only be completed by a real verified authenticator code.
    const confirm = source('app/api/admin/auth/2fa/confirm/route.ts')
    expect(confirm).toContain('verifyTotp(totpCode, adminUser.totpSecret)')
  })

  it('revokes refresh access if a SUPER_ADMIN loses MFA enrollment', () => {
    const refresh = source('app/api/admin/auth/refresh/route.ts')
    const rotation = source('lib/auth/staff-rotation.ts')

    expect(refresh).toContain('rotateStaffRefreshToken')
    expect(rotation).toContain("adminUser.role === 'SUPER_ADMIN'")
    expect(rotation).toContain('!adminUser.totpEnabled || !adminUser.totpSecret')
    expect(rotation).toContain('isRevoked: true')
    expect(rotation).toContain('return null')
  })

  it('enforces live MFA state on every guarded CRM request', () => {
    const crm = source('lib/crm/security.ts')
    expect(crm).toContain('totpEnabled: true')
    expect(crm).toContain('totpSecret: true')
    expect(crm).toContain("role === 'SUPER_ADMIN'")
    expect(crm).toContain("'CRM_MFA_REQUIRED'")
  })

  it('preflight and deployment block before switching a release if active SUPER_ADMIN MFA is missing', () => {
    const preflight = source('scripts/crm-v2-production-preflight.sh')
    const deploy = source('deploy-rsync.sh')

    for (const script of [preflight, deploy]) {
      expect(script).toContain('SUPER_ADMIN_MFA_MISSING=')
      expect(script).toContain('role: "SUPER_ADMIN"')
      expect(script).toContain('totpEnabled: false')
      expect(script).toContain('totpSecret: null')
      expect(script).toContain('active SUPER_ADMIN account is missing required MFA enrollment')
    }
  })
})
