import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM global search scope', () => {
  it('uses effective permission overrides instead of role-only checks', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/search/route.ts'),
      'utf8'
    )

    expect(source).toContain('evaluateEffectivePermission')
    expect(source).toContain('overrides: security.permissionOverrides')
    expect(source).not.toContain("crmHasPermission(security.role")
  })

  it('separates customer and tasker visibility and enforces requested market scope', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/search/route.ts'),
      'utf8'
    )

    expect(source).toContain("const canCustomers = allowed('users:view')")
    expect(source).toContain("const canTaskers = allowed('taskers:view')")
    expect(source).toContain("role: { in: visibleUserRoles }")
    expect(source).toContain('assertCrmCountryAllowed(security, requestedMarket)')
    expect(source).toContain("market: requestedMarket")
  })
})
