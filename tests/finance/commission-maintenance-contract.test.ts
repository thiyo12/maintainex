import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const source = readFileSync(
  resolve(process.cwd(), 'app/api/cron/daily-maintenance/route.ts'),
  'utf-8',
)

describe('weekly commission maintenance contract', () => {
  it('advances unpaid due settlements from PENDING to OVERDUE', () => {
    expect(source).toContain('prisma.weeklySettlement.updateMany')
    expect(source).toContain('commissionPaid: false')
    expect(source).toContain("status: 'PENDING'")
    expect(source).toContain('dueAt: { lt: now }')
    expect(source).toContain("data: { status: 'OVERDUE' }")
  })

  it('never auto-lifts a suspension caused by unpaid weekly commission', () => {
    expect(source).toContain("{ suspensionReason: { not: 'Weekly commission not paid' } }")
    expect(source).toContain('weeklySettlementsMarkedOverdue: overdueSettlements.count')
  })
})
