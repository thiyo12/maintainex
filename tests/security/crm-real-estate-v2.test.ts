import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPermissionCatalogEntry } from '@/lib/crm/governance'

describe('CRM V2 real-estate boundary', () => {
  it('registers read and sensitive moderation permissions', () => {
    expect(getPermissionCatalogEntry('realestate:view')).toMatchObject({ class: 'READ' })
    expect(getPermissionCatalogEntry('realestate:manage')).toMatchObject({ class: 'SENSITIVE' })
  })

  it('uses the three-layer CRM guard, market scope and audit trail', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/admin/real-estate/route.ts'), 'utf8')
    expect(source).toContain("permission: 'realestate:view'")
    expect(source).toContain("permission: 'realestate:manage'")
    expect(source).toContain("permissionClass: 'SENSITIVE'")
    expect(source).toContain('requireCountryScope: true')
    expect(source).toContain('assertCrmCountryAllowed')
    expect(source).toContain('createAuditLog')
    expect(source).not.toContain('contactPhone:')
    expect(source).not.toContain('message: item.message')
    expect(source).toContain('prisma.fraudEvent.groupBy')
    expect(source).toContain('prisma.adminFlag.findMany')
    expect(source).toContain('riskSignals')
  })

  it('uses the approved V2 visual system and global market scope', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/(admin)/admin/real-estate/page.tsx'), 'utf8')
    expect(source).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(source).toContain("from '@/components/crm/v2/CrmOverlays'")
    expect(source).toContain('useCrmShell')
    expect(source).toContain("permissions?.includes('realestate:view')")
    expect(source).toContain("permissions?.includes('realestate:manage')")
    expect(source).not.toContain('ROLE_PERMISSIONS')
  })

  it('keeps boost activation wallet-backed, idempotent and ledger-posted', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/properties/[id]/boost/route.ts'), 'utf8')
    expect(source).toContain('Idempotency-Key')
    expect(source).toContain('property-boost-op:')
    expect(source).toContain('postLedgerTransaction')
    expect(source).toContain("paymentMethod !== 'wallet'")
  })

  it('retires the Phase 12 placeholder navigation entry', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/admin/AdminLayout.tsx'), 'utf8')
    expect(source).toContain("href: '/admin/real-estate'")
    expect(source).toContain("permissions: ['realestate:view']")
    expect(source).not.toContain("badge: 'Phase 12'")
  })
})
