import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 promotions boundary', () => {
  it('uses canonical promotion permissions server-side', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/platform/offers/route.ts'),
      'utf8'
    )

    expect(source).toContain("permission: 'promotions:view'")
    expect(source).toContain("permission: 'promotions:manage'")
    expect(source).not.toContain("permission: 'settings:view'")
    expect(source).not.toContain("permission: 'settings:edit'")
  })

  it('caps percentage discounts at 100 percent', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/platform/offers/route.ts'),
      'utf8'
    )

    expect(source).toContain("discountType === 'PERCENTAGE' && discountValue > 100")
  })

  it('uses the approved V2 visual system and effective permissions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/offers/page.tsx'),
      'utf8'
    )

    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain("from '@/components/crm/v2/CrmOverlays'")
    expect(source).toContain("permissions?.includes('promotions:view')")
    expect(source).toContain("permissions?.includes('promotions:manage')")
    expect(source).not.toContain('ROLE_PERMISSIONS')
  })
})
