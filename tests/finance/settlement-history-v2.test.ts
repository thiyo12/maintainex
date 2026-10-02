import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('CRM V2 settlement history contract', () => {
  it('uses a dedicated read-only finance API with canonical permissions', () => {
    const api = read('app/api/admin/financial/settlements/route.ts')

    expect(api).toContain("permission: 'finance:settlements:view'")
    expect(api).toContain("permissionClass: 'READ'")
    expect(api).toContain('requireCountryScope: true')
    expect(api).toContain("status: 'PAID'")
    expect(api).toContain('commissionPaid: true')
    expect(api).toContain('where.paidAt')
    expect(api).not.toContain('export async function POST')
    expect(api).not.toContain('export async function PATCH')
    expect(api).not.toContain('export async function DELETE')
  })

  it('resolves company settlements through CompanyProfile while keeping tasker user identity', () => {
    const api = read('app/api/admin/financial/settlements/route.ts')

    expect(api).toContain('prisma.companyProfile.findMany')
    expect(api).toContain("where: { userId: { in: companyProviderIds } }")
    expect(api).toContain('company.companyName')
    expect(api).toContain('user.name')
  })

  it('uses V2 primitives and removes the legacy dark settlement UI', () => {
    const page = read('app/(admin)/admin/financial/settlements/page.tsx')

    expect(page).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(page).toContain('/api/admin/financial/settlements')
    expect(page).toContain('CrmPageHeader')
    expect(page).toContain('CrmTableFrame')
    expect(page).toContain('CrmPagination')
    expect(page).not.toContain("bg-[#15161E]")
    expect(page).not.toContain('text-white">Settlement History')
  })

  it('labels export as current-page only rather than implying an unrestricted bulk export', () => {
    const page = read('app/(admin)/admin/financial/settlements/page.tsx')
    expect(page).toContain('Export current page')
    expect(page).toContain('No settlements on this page to export')
  })
})
