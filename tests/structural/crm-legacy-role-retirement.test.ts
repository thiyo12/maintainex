import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 legacy admin-role retirement', () => {
  it('removes the obsolete CRM access-control module', () => {
    expect(existsSync(resolve(process.cwd(), 'lib/crm/access-control.ts'))).toBe(false)
  })

  it('keeps the canonical admin role vocabulary free of legacy province/branch roles', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'lib/auth/rbac/permissions.ts'),
      'utf8'
    )

    expect(source).not.toContain('PROVINCE_ADMIN')
    expect(source).not.toContain('BRANCH_ADMIN')
    expect(source).not.toContain("'ADMIN'")
  })

  it('does not default AdminUser to a legacy role', () => {
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const start = schema.indexOf('model AdminUser {')
    const end = schema.indexOf('\n}', start)
    const block = schema.slice(start, end)

    expect(block).not.toContain('@default("ADMIN")')
  })
})
