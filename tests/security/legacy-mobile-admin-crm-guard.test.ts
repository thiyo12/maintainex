import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const legacyAdminRoutes = [
  'app/api/mobile/v2/admin/commission-settle/route.ts',
  'app/api/mobile/v2/admin/escrows/route.ts',
  'app/api/mobile/v2/admin/identity/[id]/route.ts',
  'app/api/mobile/v2/admin/identity/route.ts',
  'app/api/mobile/v2/admin/jobs/route.ts',
  'app/api/mobile/v2/admin/seed-categories/route.ts',
  'app/api/mobile/v2/admin/summary/route.ts',
]

describe('legacy mobile admin routes use canonical CRM security', () => {
  for (const path of legacyAdminRoutes) {
    it(`${path} is guarded by the canonical CRM boundary`, () => {
      const source = readFileSync(resolve(process.cwd(), path), 'utf-8')
      expect(source).toContain('guardCrmRequest')
      expect(source).not.toContain("authenticateRequest(request)")
      expect(source).not.toContain("authenticateRequest(_request)")
      expect(source).not.toContain("['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes")
    })
  }

  it('country-scoped legacy data routes fail closed on admin market scope', () => {
    for (const path of legacyAdminRoutes.filter(path => !path.includes('seed-categories'))) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf-8')
      expect(source).toContain('requireCountryScope: true')
    }
  })

  it('global category seeding is super-admin-only', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/v2/admin/seed-categories/route.ts'),
      'utf-8'
    )
    expect(source).toContain("allowedRoles: ['SUPER_ADMIN']")
    expect(source).toContain("permission: 'settings:edit'")
  })

  it('legacy finance mutations use sensitive CRM authorization', () => {
    for (const path of [
      'app/api/mobile/v2/admin/commission-settle/route.ts',
      'app/api/mobile/v2/admin/escrows/route.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf-8')
      expect(source).toContain("level: 'sensitive'")
      expect(source).toContain("permission: 'commission:manage'")
    }
  })
})


describe('mixed legacy mobile admin routes', () => {
  it('keeps subscription plans readable but protects plan creation with canonical CRM auth', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/admin/subscription-plans/route.ts'),
      'utf-8'
    )
    expect(source).toContain('export async function GET')
    expect(source).toContain('export async function POST')
    expect(source).toContain('guardCrmRequest')
    expect(source).toContain("permission: 'settings:edit'")
    expect(source).toContain("allowedRoles: ['SUPER_ADMIN']")
    expect(source).not.toContain("['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes")
  })
})
