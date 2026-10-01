import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('CRM UI/API permission contract', () => {
  const cases = [
    {
      page: 'app/(admin)/admin/financial/commission/page.tsx',
      api: 'app/api/admin/financial/commission/route.ts',
      permission: 'commission:manage',
      clientGuard: 'canManageCommission',
    },
    {
      page: 'app/(admin)/admin/financial/wallets/page.tsx',
      api: 'app/api/admin/financial/wallets/route.ts',
      permission: 'wallets:manage',
      clientGuard: 'canManageWallets',
    },
    {
      page: 'app/(admin)/admin/jobs/disputes/page.tsx',
      api: 'app/api/admin/disputes/route.ts',
      permission: 'disputes:resolve',
      clientGuard: 'canResolveDisputes',
    },
    {
      page: 'app/(admin)/admin/trust-safety/credentials/page.tsx',
      api: 'app/api/admin/credentials/[id]/review/route.ts',
      permission: 'credentials:write',
      clientGuard: 'canReviewCredentials',
    },
    {
      page: 'app/(admin)/admin/pricing/market-config/page.tsx',
      api: 'app/api/admin/market-config/route.ts',
      permission: 'market_config:write',
      clientGuard: 'canWriteMarketConfig',
    },
    {
      page: 'app/(admin)/admin/wishlist/page.tsx',
      api: 'app/api/admin/wishlist/route.ts',
      permission: 'wishlist:manage',
      clientGuard: 'canManageWishlist',
    },
  ] as const

  for (const item of cases) {
    it(`${item.page} gates mutations with the same permission as its API`, () => {
      const page = read(item.page)
      const api = read(item.api)

      expect(api).toContain(`permission: '${item.permission}'`)
      expect(page).toContain('ROLE_PERMISSIONS')
      expect(page).toContain(`.includes('${item.permission}')`)
      expect(page).toContain(item.clientGuard)
    })
  }

  it('security monitor uses security:audit capability rather than a hard-coded admin role', () => {
    const page = read('app/(admin)/admin/analytics/security-monitor/page.tsx')
    const api = read('app/api/admin/security/blocked-ips/route.ts')

    expect(api).toContain("permission: 'security:audit'")
    expect(page).toContain(".includes('security:audit')")
    expect(page).not.toContain("canManageBlocks = user?.role === 'SUPER_ADMIN'")
  })

  it('trust and safety tables are horizontally contained on narrow screens', () => {
    for (const path of [
      'app/(admin)/admin/trust-safety/credentials/page.tsx',
      'app/(admin)/admin/trust-safety/risk-events/page.tsx',
    ]) {
      const page = read(path)
      expect(page).toContain('overflow-x-auto')
      expect(page).toMatch(/min-w-\[\d+px\]/)
    }
  })
})
