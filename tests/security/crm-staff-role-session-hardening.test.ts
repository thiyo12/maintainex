import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM staff role/session hardening', () => {
  it('does not give AdminUser an obsolete ADMIN default role', () => {
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const start = schema.indexOf('model AdminUser {')
    const end = schema.indexOf('\n}', start)
    const adminBlock = schema.slice(start, end)

    expect(adminBlock).toContain('role                String')
    expect(adminBlock).not.toContain('@default("ADMIN")')
  })

  it('revokes active staff sessions after role, scope, password, or deactivation changes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/admins/route.ts'),
      'utf8'
    )

    expect(source).toContain('const securitySensitiveChange')
    expect(source).toContain('body?.role !== undefined')
    expect(source).toContain('body?.assignedCountries !== undefined')
    expect(source).toContain('body?.password !== undefined')
    expect(source).toContain('prisma.adminSession.updateMany')
    expect(source).toContain('isRevoked: true')
  })

  it('blocks self role/scope mutation through staff management', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/admins/route.ts'),
      'utf8'
    )

    expect(source).toContain(
      'You cannot change your own role or country scope through staff management'
    )
  })
})
