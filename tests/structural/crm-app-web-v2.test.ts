import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 App & Web surfaces', () => {
  it('uses canonical platform overview permission', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/platform/overview/route.ts'),
      'utf8'
    )
    expect(source).toContain("permission: 'platform:settings:view'")
    expect(source).not.toContain("permission: 'settings:view'")
  })

  it('keeps Mobile Management on the shared V2 design without fake switches', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/mobile/page.tsx'),
      'utf8'
    )
    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain("permissions?.includes('platform:settings:view')")
    expect(source).toContain('Release-version switches and arbitrary feature toggles are intentionally absent')
    expect(source).not.toContain('ROLE_PERMISSIONS')
  })

  it('keeps Notification Centre on the shared V2 design', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/notifications/page.tsx'),
      'utf8'
    )
    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain('title="Notification centre"')
  })

  it('removes fake website settings mutations until runtime wiring exists', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/platform/website/page.tsx'),
      'utf8'
    )
    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain('No fake maintenance or website-booking switch')
    expect(source).not.toContain("method: 'PUT'")
    expect(source).not.toContain('ROLE_PERMISSIONS')
    expect(source).not.toContain('checked={form.maintenanceMode}')
  })
})
