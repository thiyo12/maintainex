import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('mandatory super-admin MFA', () => {
  it('blocks password-only SUPER_ADMIN login when MFA is not enrolled', () => {
    const login = source('app/api/admin/auth/login/route.ts')
    expect(login).toContain("adminUser.role === 'SUPER_ADMIN'")
    expect(login).toContain('!adminUser.totpEnabled || !adminUser.totpSecret')
    expect(login).toContain("failureReason: 'MFA_ENROLLMENT_REQUIRED'")
    expect(login).toContain("code: 'MFA_ENROLLMENT_REQUIRED'")
  })

  it('revokes refresh access if a SUPER_ADMIN loses MFA enrollment', () => {
    const refresh = source('app/api/admin/auth/refresh/route.ts')
    expect(refresh).toContain("adminUser.role === 'SUPER_ADMIN'")
    expect(refresh).toContain('!adminUser.totpEnabled || !adminUser.totpSecret')
    expect(refresh).toContain('isRevoked: true')
    expect(refresh).toContain("code: 'MFA_ENROLLMENT_REQUIRED'")
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
