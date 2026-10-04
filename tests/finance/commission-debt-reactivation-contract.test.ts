import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('commission debt reactivation contract', () => {
  it('keeps evidence-backed payment reconciliation separate from manual debt-preserving UNSUSPEND', () => {
    const route = read('app/api/admin/financial/commission/route.ts')

    expect(route).toContain("action === 'UNSUSPEND'")
    expect(route).toContain("action === 'MARK_PAID'")
    expect(route).toContain('COMMISSION_PAYMENT_EVIDENCE_REQUIRED')
    expect(route).toContain('const otherSuspendedDebt = await tx.weeklySettlement.count')
    expect(route).toContain("id: { not: settlement.id }")
    expect(route).toContain('commissionPaid: false')
    expect(route).toContain('otherSuspendedDebt === 0')
  })

  it('does not reactivate a provider after confirming one payment when other blocking debt exists', () => {
    const route = read('app/api/admin/financial/commission/payments/route.ts')

    expect(route).toContain('const otherBlockingDebt = await tx.weeklySettlement.count')
    expect(route).toContain("id: { not: settlement.id }")
    expect(route).toContain('commissionPaid: false')
    expect(route).toContain("status: { in: ['OVERDUE', 'SUSPENDED'] }")
    expect(route).toContain('{ dueAt: { lt: now } }')
    expect(route).toContain('if (otherBlockingDebt === 0)')
    expect(route).toContain("provider?.suspensionReason === 'Weekly commission not paid'")
  })
})
