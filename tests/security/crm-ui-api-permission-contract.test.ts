import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('CRM UI/API permission contract', () => {
  it('commission enforcement uses the same governed action in UI and API', () => {
    const page = read('app/(admin)/admin/financial/commission/page.tsx')
    const api = read('app/api/admin/financial/commission/route.ts')
    const registry = read('lib/crm/governance/action-registry.ts')

    expect(page).toContain('finance.commission.enforce')
    expect(api).toContain("guardCrmAction(request, 'finance.commission.enforce')")
    expect(registry).toContain("'finance.commission.enforce':")
    expect(registry).toContain("initiatePermission: 'finance:commission:enforce'")
  })

  it('wallet freeze controls use the same governed action in UI and API', () => {
    const page = read('app/(admin)/admin/financial/wallets/page.tsx')
    const api = read('app/api/admin/financial/wallets/route.ts')
    const registry = read('lib/crm/governance/action-registry.ts')

    expect(page).toContain('finance.wallet.freeze')
    expect(api).toContain("guardCrmAction(request, 'finance.wallet.freeze')")
    expect(registry).toContain("'finance.wallet.freeze':")
    expect(registry).toContain("initiatePermission: 'finance:wallets:freeze'")
  })

  it('dispute resolution UI and API both require disputes:resolve', () => {
    const page = read('app/(admin)/admin/jobs/disputes/page.tsx')
    const api = read('app/api/admin/disputes/route.ts')

    expect(page).toContain("permissions?.includes('disputes:resolve')")
    expect(api).toContain("permission: 'disputes:resolve'")
  })

  it('credential review UI and API both use the canonical credentials:manage permission', () => {
    const page = read('app/(admin)/admin/trust-safety/credentials/page.tsx')
    const api = read('app/api/admin/credentials/[id]/review/route.ts')
    const aliases = read('lib/crm/governance/permissions.ts')

    expect(page).toContain("permissions?.includes('credentials:manage')")
    expect(api).toContain("permission: 'credentials:manage'")
    expect(aliases).toContain("'credentials:manage': ['credentials:write']")
  })

  it('market configuration uses canonical market/pricing permissions on both surfaces', () => {
    const page = read('app/(admin)/admin/pricing/market-config/page.tsx')
    const api = read('app/api/admin/market-config/route.ts')

    expect(page).toContain("permissions?.includes('markets:manage')")
    expect(page).toContain("permissions?.includes('pricing:manage')")
    expect(api).toContain("permission: 'markets:manage'")
  })

  it('retired wishlist admin surface stays removed rather than reviving legacy permissions', () => {
    expect(existsSync(resolve(process.cwd(), 'app/(admin)/admin/wishlist/page.tsx'))).toBe(false)
    expect(existsSync(resolve(process.cwd(), 'app/api/admin/wishlist/route.ts'))).toBe(false)
  })

  it('security monitor uses security:audit for block/unblock mutations', () => {
    const page = read('app/(admin)/admin/analytics/security-monitor/page.tsx')
    const api = read('app/api/admin/security/blocked-ips/route.ts')

    expect(page).toContain("permissions?.includes('security:audit')")
    expect(api).toContain("permission: 'security:audit'")
    expect(page).not.toContain("canManageBlocks = user?.role === 'SUPER_ADMIN'")
  })

  it('trust and safety tables use the shared horizontally scrollable CRM table frame', () => {
    const credentials = read('app/(admin)/admin/trust-safety/credentials/page.tsx')
    const riskEvents = read('app/(admin)/admin/trust-safety/risk-events/page.tsx')
    const primitives = read('components/crm/v2/CrmPrimitives.tsx')

    expect(credentials).toContain('CrmTableFrame')
    expect(riskEvents).toContain('CrmTableFrame')
    expect(primitives).toContain('overflow-x-auto')
  })
})
