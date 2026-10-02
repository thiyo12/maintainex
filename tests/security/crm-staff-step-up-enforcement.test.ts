import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM staff mutation step-up enforcement', () => {
  it('requires governed actions and one-time step-up proof for staff account mutations', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/admins/route.ts'),
      'utf8'
    )

    expect(source).toContain("guardCrmAction(request, 'staff.create')")
    expect(source).toContain("actionId: 'staff.create'")
    expect(source).toContain("guardCrmAction(request, 'staff.account.update')")
    expect(source).toContain("actionId: 'staff.account.update'")
    expect(source).toContain("guardCrmAction(request, 'staff.delete')")
    expect(source).toContain("actionId: 'staff.delete'")
    expect(source.match(/Step-up authentication required/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('requires one-time step-up proof for granular permission changes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/admins/[id]/permissions/route.ts'),
      'utf8'
    )

    expect(source).toContain("guardCrmAction(request, 'staff.permission.change')")
    expect(source).toContain("actionId: 'staff.permission.change'")
    expect(source).toContain("request.headers.get('x-crm-step-up')")
  })
})
