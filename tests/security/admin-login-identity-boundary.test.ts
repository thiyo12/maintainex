import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Admin login identity boundary', () => {
  it('does not write AdminUser IDs into marketplace UserDevice records', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/auth/login/route.ts'),
      'utf8'
    )

    expect(source).not.toContain('prisma.userDevice.upsert')
    expect(source).toContain('AdminSession + AdminLoginAttempt + SecurityAudit')
  })
})
