import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 subscriptions boundary', () => {
  it('uses canonical permissions, market scope and audit protection', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/platform/subscriptions/route.ts'),
      'utf8'
    )

    expect(source).toContain("permission: 'subscriptions:view'")
    expect(source).toContain("permission: 'subscriptions:manage'")
    expect(source).toContain('requireCountryScope: true')
    expect(source).toContain('assertCrmCountryAllowed')
    expect(source).toContain('createAuditLog')
    expect(source).toContain('Only plan activation/deactivation is supported')
  })

  it('uses the approved V2 visual system with effective permissions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/subscriptions/page.tsx'),
      'utf8'
    )

    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain("from '@/components/crm/v2/CrmOverlays'")
    expect(source).toContain("permissions?.includes('subscriptions:view')")
    expect(source).toContain("permissions?.includes('subscriptions:manage')")
    expect(source).toContain('Immutable price snapshots')
    expect(source).not.toContain('ROLE_PERMISSIONS')
  })

  it('is reachable from the canonical App and Web control plane', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/page.tsx'),
      'utf8'
    )
    expect(source).toContain("href: '/admin/platform/subscriptions'")
  })
})
