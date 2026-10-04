import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const activeLegacyAdminRoutes = [
  'app/api/mobile/v2/admin/escrows/route.ts',
  'app/api/mobile/v2/admin/identity/[id]/route.ts',
  'app/api/mobile/v2/admin/identity/route.ts',
  'app/api/mobile/v2/admin/jobs/route.ts',
  'app/api/mobile/v2/admin/seed-categories/route.ts',
  'app/api/mobile/v2/admin/summary/route.ts',
]

const retiredLegacyRoutes = [
  'app/api/mobile/v2/admin/commission-settle/route.ts',
  'app/api/mobile/admin/subscription-plans/route.ts',
]

describe('legacy mobile admin routes use canonical CRM security', () => {
  for (const path of activeLegacyAdminRoutes) {
    it(`${path} is guarded by the canonical CRM boundary`, () => {
      const source = readFileSync(resolve(process.cwd(), path), 'utf-8')
      expect(source).toContain('guardCrmRequest')
      expect(source).not.toContain('authenticateRequest(request)')
      expect(source).not.toContain('authenticateRequest(_request)')
      expect(source).not.toContain("['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes")
    })
  }

  it('retired legacy finance/subscription admin APIs stay removed', () => {
    for (const path of retiredLegacyRoutes) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(false)
    }
  })

  it('country-scoped legacy data routes fail closed on admin market scope', () => {
    for (const path of activeLegacyAdminRoutes.filter(path => !path.includes('seed-categories'))) {
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

  it('remaining legacy escrow finance mutation uses sensitive CRM authorization', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/v2/admin/escrows/route.ts'),
      'utf-8'
    )
    expect(source).toContain("level: 'sensitive'")
    expect(source).toContain("permission: 'commission:manage'")
  })
})
