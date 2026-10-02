import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Admin TOTP verification safety', () => {
  it('awaits authenticator verification before issuing an admin session', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/auth/2fa/verify/route.ts'),
      'utf8'
    )

    expect(source).toContain('await verifyTotp(totpCode, adminUser.totpSecret)')
    expect(source).not.toContain('if (!verifyTotp(totpCode, adminUser.totpSecret))')
    expect(source.indexOf('await verifyTotp')).toBeLessThan(
      source.indexOf('prisma.adminSession.create')
    )
  })

  it('requires password reauthentication before generating a new TOTP secret', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/auth/2fa/setup/route.ts'),
      'utf8'
    )

    expect(source).toContain('currentPassword')
    expect(source).toContain('verifyPasswordWithMigration')
    expect(source).toContain('Two-factor authentication is already enabled.')
    expect(source).toContain('totpVerifiedAt: null')
  })

  it('confirms enrollment with awaited TOTP verification and revokes other sessions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/auth/2fa/confirm/route.ts'),
      'utf8'
    )

    expect(source).toContain('await verifyTotp(totpCode, adminUser.totpSecret)')
    expect(source).toContain('totpEnabled: true')
    expect(source).toContain('id: { not: security.sessionId }')
    expect(source).toContain('isRevoked: true')
    expect(source).toContain("action: '2FA_ENABLED'")
  })
})
