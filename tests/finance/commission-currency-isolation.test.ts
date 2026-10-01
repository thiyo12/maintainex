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

    expect(page).toContain('formatCurrency(s.totalEarnings, s.currency)')
    expect(page).toContain('formatCurrency(s.commissionOwed, s.currency)')
    expect(page).toContain('summaryByCurrency.flatMap')
    expect(page).not.toContain("currency: 'LKR',")
  })
})
