import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 profession taxonomy boundary', () => {
  it('uses canonical catalog permissions across profession APIs', () => {
    const paths = [
      'app/api/admin/professions/route.ts',
      'app/api/admin/professions/[id]/route.ts',
      'app/api/admin/professions/[id]/skills/route.ts',
      'app/api/admin/professions/submissions/route.ts',
      'app/api/admin/professions/submissions/[id]/route.ts',
    ]

    const sources = paths.map(path =>
      readFileSync(resolve(process.cwd(), path), 'utf8')
    )

    for (const source of sources) {
      expect(source).not.toContain("permission: 'professions:read'")
      expect(source).not.toContain("permission: 'professions:write'")
    }

    expect(sources.join('\n')).toContain("permission: 'catalog:view'")
    expect(sources.join('\n')).toContain("permission: 'catalog:edit'")
    expect(sources.join('\n')).toContain("permission: 'catalog:publish'")
  })

  it('creates professions and skills inactive by default', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'lib/profession/index.ts'),
      'utf8'
    )

    expect(source).toContain('isActive: input.isActive ?? false')
    expect(source.match(/isActive: input\.isActive \?\? false/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('requires publication authority for active taxonomy state', () => {
    const profession = readFileSync(
      resolve(process.cwd(), 'app/api/admin/professions/[id]/route.ts'),
      'utf8'
    )
    const skills = readFileSync(
      resolve(process.cwd(), 'app/api/admin/professions/[id]/skills/route.ts'),
      'utf8'
    )

    expect(profession).toContain('Changing profession publication state requires catalog:publish')
    expect(skills).toContain('Changing skill publication state requires catalog:publish')
  })

  it('ships a V2 taxonomy workspace linked from catalog', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/professions/page.tsx'),
      'utf8'
    )
    const catalog = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/catalog/page.tsx'),
      'utf8'
    )

    expect(page).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(page).toContain("permissions?.includes('catalog:view')")
    expect(page).toContain("permissions?.includes('catalog:edit')")
    expect(page).toContain("permissions?.includes('catalog:publish')")
    expect(page).not.toContain('ROLE_PERMISSIONS')
    expect(catalog).toContain('href="/admin/platform/professions"')
  })
})
