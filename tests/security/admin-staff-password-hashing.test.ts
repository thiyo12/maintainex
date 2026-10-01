import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM staff password hashing contract', () => {
  it('uses the canonical peppered password helper for staff create/reset flows', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/admins/route.ts'),
      'utf8'
    )

    expect(source).toContain("import { hashPassword } from '@/lib/security/password'")
    expect(source).not.toContain("from 'bcryptjs'")
    expect(source).toContain('const passwordHash = await hashPassword(password)')
    expect(source).toContain('updateData.passwordHash = await hashPassword(body.password)')
  })
})
