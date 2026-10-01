import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 legacy customer API retirement', () => {
  const retired = [
    'app/api/customers/route.ts',
    'app/api/customers/[id]/route.ts',
    'app/api/customers/[id]/activities/route.ts',
    'app/api/customers/[id]/communications/route.ts',
    'app/api/customers/[id]/notes/route.ts',
  ]

  it('keeps obsolete province-based customer CRM endpoints removed', () => {
    for (const path of retired) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(false)
    }
  })

  it('uses the canonical admin users API for the current customer admin page', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/users/customers/page.tsx'),
      'utf8'
    )

    expect(source).toContain('/api/admin/users')
    expect(source).not.toContain('/api/customers')
  })

  it('does not preserve the legacy CRM_CREATED password placeholder in active admin customer routes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/users/customers/page.tsx'),
      'utf8'
    )
    expect(source).not.toContain('CRM_CREATED')
  })
})
