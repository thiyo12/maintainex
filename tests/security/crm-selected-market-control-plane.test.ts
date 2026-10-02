import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('CRM selected international market control plane', () => {
  it('treats the shell market as a server-validated authorization scope', () => {
    const security = source('lib/crm/security.ts')
    const shell = source('components/admin/AdminLayout.tsx')

    expect(security).toContain("request.cookies.get('maintainex_crm_market')")
    expect(security).toContain("request.nextUrl.searchParams.get('market')")
    expect(security).toContain("request.headers.get('x-crm-market')")
    expect(security).toContain('CRM_MARKET_FORBIDDEN')
    expect(security).toContain('CRM_MARKET_UNKNOWN')
    expect(security).toContain('getCrmCountryCodes')
    expect(shell).toContain('maintainex_crm_market=')
    expect(shell).toContain('window.location.reload()')
  })

  it('keeps core marketplace and finance reads on the selected market', () => {
    const expectations: Array<[string, string]> = [
      ['app/api/dashboard/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/jobs/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/financial/overview/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/financial/payments/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/financial/escrow/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/financial/refunds/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/financial/payouts/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/financial/wallets/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/approvals/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/analytics/route.ts', 'getCrmCountryCodes'],
    ]

    for (const [path, marker] of expectations) {
      expect(source(path), path).toContain(marker)
    }
  })

  it('keeps trust, property and platform market controls on the selected market', () => {
    const expectations: Array<[string, string]> = [
      ['app/api/admin/trust-safety/overview/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/risk-events/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/credentials/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/real-estate/route.ts', 'getCrmCountryFilter'],
      ['app/api/admin/platform/catalog/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/platform/locations/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/platform/offers/route.ts', 'getCrmCountryCodes'],
      ['app/api/admin/platform/subscriptions/route.ts', 'getCrmCountryCodes'],
    ]

    for (const [path, marker] of expectations) {
      expect(source(path), path).toContain(marker)
    }
  })

  it('keeps sensitive single-record mutations behind the canonical country assertion', () => {
    for (const path of [
      'app/api/admin/quotes/[id]/route.ts',
      'app/api/admin/financial/payouts/[id]/route.ts',
      'app/api/admin/financial/commission/route.ts',
      'app/api/admin/financial/commission/payments/route.ts',
      'app/api/admin/approvals/[id]/decision/route.ts',
    ]) {
      expect(source(path), path).toContain('assertCrmCountryAllowed')
    }
  })
})
