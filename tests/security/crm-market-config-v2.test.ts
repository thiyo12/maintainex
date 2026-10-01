import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 market configuration boundary', () => {
  it('uses the canonical V2 design system and permissions in the page', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/pricing/market-config/page.tsx'),
      'utf8'
    )

    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain("permissions?.includes('markets:view')")
    expect(source).toContain("permissions?.includes('markets:manage')")
    expect(source).toContain("permissions?.includes('pricing:manage')")
    expect(source).not.toContain('ROLE_PERMISSIONS')
    expect(source).not.toContain('bg-[#15161E]')
    expect(source).not.toContain('text-white">Market Configuration')
  })

  it('requires canonical market permissions and additional pricing authority server-side', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/market-config/route.ts'),
      'utf8'
    )

    expect(source).toContain("permission: 'markets:view'")
    expect(source).toContain("permission: 'markets:manage'")
    expect(source).toContain("'pricing:manage'")
    expect(source).toContain('PRICING_FIELDS')
    expect(source).toContain('Pricing-affecting market changes require pricing:manage')
    expect(source).not.toContain("permission: 'market_config:read'")
    expect(source).not.toContain("permission: 'market_config:write'")
  })
})
