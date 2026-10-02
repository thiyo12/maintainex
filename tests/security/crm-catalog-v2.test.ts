import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 catalog boundary', () => {
  it('uses canonical catalog permissions in the API', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/platform/catalog/route.ts'),
      'utf8'
    )

    expect(source).toContain("permission: 'catalog:view'")
    expect(source).toContain("permission: 'catalog:edit'")
    expect(source).toContain("permission: 'catalog:publish'")
    expect(source).not.toContain("permission: 'settings:view'")
    expect(source).not.toContain("permission: 'settings:edit'")
  })

  it('keeps draft editing separate from public activation', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/platform/catalog/route.ts'),
      'utf8'
    )

    expect(source).toContain('requestedActive')
    expect(source).toContain('Publishing permission is required to create an active catalog item')
    expect(source).toContain('canPublishCatalog')
  })

  it('uses the approved V2 visual system and effective permissions in the page', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/catalog/page.tsx'),
      'utf8'
    )

    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain("from '@/components/crm/v2/CrmOverlays'")
    expect(source).toContain("permissions?.includes('catalog:view')")
    expect(source).toContain("permissions?.includes('catalog:edit')")
    expect(source).toContain("permissions?.includes('catalog:publish')")
    expect(source).not.toContain('ROLE_PERMISSIONS')
  })
})
