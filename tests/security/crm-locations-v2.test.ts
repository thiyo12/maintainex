import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 location source-of-truth boundary', () => {
  it('uses V2 primitives and canonical market permissions in the CRM workspace', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/locations/page.tsx'),
      'utf8'
    )

    expect(page).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(page).toContain("permissions?.includes('markets:view')")
    expect(page).toContain("permissions?.includes('markets:manage')")
    expect(page).toContain('/api/admin/platform/locations')
    expect(page).not.toContain('ROLE_PERMISSIONS')
  })

  it('protects location writes with canonical market scope and has no DELETE handler', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/platform/locations/route.ts'),
      'utf8'
    )

    expect(source).toContain("permission: 'markets:view'")
    expect(source).toContain("permission: 'markets:manage'")
    expect(source).toContain('assertCrmCountryAllowed')
    expect(source).toContain("type === 'seed'")
    expect(source).not.toContain('export async function DELETE')
  })

  it('makes mobile V2 locations database-first with static fallback only', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/v2/locations/route.ts'),
      'utf8'
    )

    expect(source).toContain('prisma.country.findMany')
    expect(source).toContain("source: 'database'")
    expect(source).toContain("source: 'static-fallback'")
    expect(source.indexOf('prisma.country.findMany')).toBeLessThan(
      source.indexOf('getCountries()')
    )
  })

  it('keeps the old static list available only as migration fallback/seed input', () => {
    const admin = readFileSync(
      resolve(process.cwd(), 'app/api/admin/platform/locations/route.ts'),
      'utf8'
    )
    expect(admin).toContain("from '@/lib/locations'")
    expect(admin).toContain('Static fallback market not found')
  })
})

describe('CRM V2 duplicate pricing route retirement', () => {
  it('removes the unused legacy pricing-config endpoint', () => {
    expect(
      existsSync(resolve(process.cwd(), 'app/api/admin/pricing-config/route.ts'))
    ).toBe(false)
  })

  it('keeps governed pricing controls inside the canonical market config API', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/market-config/route.ts'),
      'utf8'
    )

    expect(source).toContain("permission: 'markets:manage'")
    expect(source).toContain("'pricing:manage'")
    expect(source).toContain('PRICING_FIELDS')
  })
})
