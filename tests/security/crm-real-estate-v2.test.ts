import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPermissionCatalogEntry } from '@/lib/crm/governance'

describe('CRM V2 real-estate boundary', () => {
  it('registers read and sensitive moderation permissions', () => {
    expect(getPermissionCatalogEntry('real_estate:view')).toMatchObject({ class: 'READ' })
    expect(getPermissionCatalogEntry('real_estate:manage')).toMatchObject({ class: 'SENSITIVE' })
  })

  it('uses the three-layer CRM guard, market scope and audit trail', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/admin/real-estate/route.ts'), 'utf8')
    expect(source).toContain("permission: 'real_estate:view'")
    expect(source).toContain("permission: 'real_estate:manage'")
    expect(source).toContain("permissionClass: 'SENSITIVE'")
    expect(source).toContain('requireCountryScope: true')
    expect(source).toContain('assertCrmCountryAllowed')
    expect(source).toContain('createAuditLog')
    expect(source).not.toContain('contactPhone:')
    expect(source).not.toContain('message: item.message')
  })

  it('uses the approved V2 visual system and global market scope', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/(admin)/admin/real-estate/page.tsx'), 'utf8')
    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain("from '@/components/crm/v2/CrmOverlays'")
    expect(source).toContain('useCrmShell')
    expect(source).toContain("permissions?.includes('real_estate:view')")
    expect(source).toContain("permissions?.includes('real_estate:manage')")
    expect(source).not.toContain('ROLE_PERMISSIONS')
  })

  it('retires the Phase 12 placeholder navigation entry', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/admin/AdminLayout.tsx'), 'utf8')
    expect(source).toContain("href: '/admin/real-estate'")
    expect(source).toContain("permissions: ['real_estate:view']")
    expect(source).not.toContain("badge: 'Phase 12'")
  })
})
