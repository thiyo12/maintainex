import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migratedPages = [
  'app/(admin)/admin/users/customers/page.tsx',
  'app/(admin)/admin/users/taskers/page.tsx',
  'app/(admin)/admin/users/companies/page.tsx',
  'app/(admin)/admin/admins/page.tsx',
  'app/(admin)/admin/companies/[id]/page.tsx',
]

describe('CRM V2 migrated page contract', () => {
  it('keeps migrated pages on shared V2 primitives and off legacy dark admin styling', () => {
    for (const page of migratedPages) {
      const source = readFileSync(resolve(process.cwd(), page), 'utf8')

      expect(source).toContain('@/components/crm/v2/')
      expect(source).not.toContain("ROLE_PERMISSIONS")
      expect(source).not.toContain("bg-[#15161E]")
      expect(source).not.toContain("bg-[#0B0C12]")
    }
  })

  it('keeps tasker and company list actions driven by server capabilities', () => {
    for (const page of [
      'app/(admin)/admin/users/taskers/page.tsx',
      'app/(admin)/admin/users/companies/page.tsx',
    ]) {
      const source = readFileSync(resolve(process.cwd(), page), 'utf8')
      expect(source).toContain('actions:')
      expect(source).toContain('setActions')
      expect(source).not.toContain('const canVerify =')
      expect(source).not.toContain('const canSuspend =')
      expect(source).not.toContain('const canBan =')
    }
  })

  it('keeps staff privileged mutations behind the reusable step-up UI', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/admins/page.tsx'),
      'utf8'
    )
    expect(source).toContain('CrmStepUpModal')
    expect(source).toContain("'staff.create'")
    expect(source).toContain("'staff.account.update'")
    expect(source).toContain("'staff.delete'")
    expect(source).toContain("'staff.permission.change'")
  })

  it('keeps Company 360 controls driven by server-issued live capabilities', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/companies/[id]/page.tsx'),
      'utf8'
    )
    expect(source).toContain('data.permissions.actions.suspend')
    expect(source).toContain('data.permissions.actions.verify')
    expect(source).not.toContain("permissions.includes('companies:edit')")
    expect(source).not.toContain("permissions.includes('companies:verify')")
  })
})
