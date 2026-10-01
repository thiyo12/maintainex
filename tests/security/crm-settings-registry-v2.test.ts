import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 settings ownership registry', () => {
  it('uses canonical platform settings permissions server-side', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/settings/route.ts'),
      'utf8'
    )

    expect(source).toContain("permission: 'platform:settings:view'")
    expect(source).toContain("permission: 'platform:settings:manage'")
    expect(source).not.toContain("permission: 'settings:view'")
    expect(source).not.toContain("permission: 'settings:edit'")
  })

  it('blocks generic mutation of delegated high-risk settings', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/settings/route.ts'),
      'utf8'
    )

    for (const key of [
      'commissionRate',
      'currency',
      'minTaskerStaff',
      'weeklySettlementDay',
      'autoApproveKyc',
    ]) {
      expect(source).toContain(`'${key}'`)
    }
    expect(source).toContain('must be changed through its canonical domain control')
    expect(source).not.toContain("'maintenanceMode'")

    const runtimeSource = readFileSync(
      resolve(process.cwd(), 'lib/runtime/platform-runtime.ts'),
      'utf8'
    )
    expect(runtimeSource).toContain("key: 'runtime.maintenance.enabled'")
    expect(runtimeSource).toContain("key: 'runtime.maintenance.message'")
  })

  it('uses the approved V2 design and does not expose the old generic settings editor', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/settings/page.tsx'),
      'utf8'
    )

    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain("permissions?.includes('platform:settings:view')")
    expect(source).toContain('title="Settings registry"')
    expect(source).not.toContain('ROLE_PERMISSIONS')
    expect(source).not.toContain("method: 'PUT'")
    expect(source).not.toContain('Save changes')
    expect(source).not.toContain('checked={settings.maintenanceMode}')
    expect(source).not.toContain('checked={settings.autoApproveKyc}')
  })
})
