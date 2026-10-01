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
})
