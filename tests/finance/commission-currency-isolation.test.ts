import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('commission CRM currency isolation', () => {
  it('groups summary amounts by currency and status in the API', () => {
    const api = read('app/api/admin/financial/commission/route.ts')

    expect(api).toContain("by: ['currency', 'status']")
    expect(api).toContain("by: ['currency']")
    expect(api).toContain('summaryByCurrency')
    expect(api).toContain('summary.totalCommissionOwed += amount')
    expect(api).toContain('summary.totalCommissionPaid += amount')
  })

  it('never formats every settlement as hard-coded LKR in the CRM page', () => {
    const page = read('app/(admin)/admin/financial/commission/page.tsx')

    expect(page).toContain('money(item.totalEarnings, item.currency)')
    expect(page).toContain('money(item.commissionOwed, item.currency)')
    expect(page).toContain('metrics.flatMap')
    expect(page).toContain('money(summary.totalCommissionOwed, summary.currency)')
    expect(page).toContain('money(summary.totalCommissionPaid, summary.currency)')
    expect(page).not.toContain("currency: 'LKR',")
  })

  it('keeps tasker and company MaintainEX balance UI currency-aware', () => {
    const taskerApi = read('app/api/mobile/earnings/route.ts')
    const companyApi = read('app/api/mobile/company/earnings/route.ts')
    const taskerUi = read('apps/mobile/features/tasker/screens/tabs/earnings.tsx')
    const companyUi = read('apps/mobile/features/company/screens/tabs/earnings-list.tsx')

    expect(taskerApi).toContain('countryCode,')
    expect(taskerApi).toContain('currency,')
    expect(companyApi).toContain("countryCode: company.countryCode || 'LK'")
    expect(companyApi).toContain('currency,')
    expect(companyApi).toContain('countryCode: company.countryCode || \'LK\',\n        currency,')

    expect(taskerUi).toContain("const displayCurrency = data?.currency")
    expect(companyUi).toContain("const displayCurrency = earnings?.currency")
    expect(taskerUi).not.toContain('>LKR {')
    expect(companyUi).not.toContain('>LKR {')
  })

  it('feeds tasker transaction history from the canonical wallet ledger', () => {
    const taskerApi = read('app/api/mobile/earnings/route.ts')
    const taskerUi = read('apps/mobile/features/tasker/screens/tabs/earnings.tsx')
    const companyUi = read('apps/mobile/features/company/screens/tabs/earnings-list.tsx')

    expect(taskerApi).toContain("accountType: 'PROVIDER_WALLET'")
    expect(taskerApi).toContain('transactions: walletLedgerEntries.map')
    expect(taskerUi).toContain("tx.direction === 'DEBIT' ? '-' : '+'")
    expect(taskerUi).toContain("router.push('/(tasker)/wallet/withdraw'")
    expect(companyUi).toContain("['PAID', 'SUCCEEDED', 'CLEARED', 'COMPLETED'].includes(status)")
  })
})
