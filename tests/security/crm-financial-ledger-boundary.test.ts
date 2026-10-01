import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('CRM V2 financial ledger boundary', () => {
  it('keeps ledger access read-only and market scoped', () => {
    const route = source('app/api/admin/financial/ledger/route.ts')

    expect(route).toContain("permission: 'finance:ledger:view'")
    expect(route).toContain('requireCountryScope: true')
    expect(route).toContain('"countryCode" IN')
    expect(route).toContain("b."referenceType" = 'REVERSAL'")
    expect(route).not.toContain('financialLedger.update')
    expect(route).not.toContain('financialLedger.delete')
    expect(route).not.toContain('financialLedger.create')
  })

  it('does not return ledger metadata or idempotency keys to the CRM page', () => {
    const route = source('app/api/admin/financial/ledger/route.ts')
    const projection = route.slice(
      route.indexOf('SELECT\n          id'),
      route.indexOf('FROM resolved', route.indexOf('SELECT\n          id'))
    )

    expect(projection).not.toContain('metadata')
    expect(projection).not.toContain('idempotencyKey')
  })

  it('keeps the ledger UI immutable', () => {
    const page = source('app/(admin)/admin/financial/ledger/page.tsx')

    expect(page).toContain('@/components/crm/v2/')
    expect(page).toContain('/api/admin/financial/ledger')
    expect(page).not.toContain("method: 'PATCH'")
    expect(page).not.toContain("method: 'POST'")
    expect(page).not.toContain("method: 'DELETE'")
    expect(page).toContain('Immutable by design')
  })

  it('makes finance ledger view assignable through the canonical staff permission catalog', () => {
    const permissions = source('lib/crm/governance/permissions.ts')
    const catalog = source('tests/security/crm-permission-catalog.test.ts')

    expect(permissions).toContain("'finance:ledger:view'")
    expect(catalog).toContain("getPermissionCatalogEntry('finance:ledger:view')")
  })
})
