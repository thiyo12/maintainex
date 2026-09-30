import { describe, expect, it } from 'vitest'
import { getWeeklySettlementAdminUpdate } from '@/lib/finance/commission/settlement-actions'

describe('weekly commission admin state transitions', () => {
  const now = new Date('2026-09-30T06:00:00.000Z')

  it('never marks commission paid when an overdue suspended provider is reactivated', () => {
    expect(
      getWeeklySettlementAdminUpdate({
        action: 'UNSUSPEND',
        dueAt: new Date('2026-09-20T00:00:00.000Z'),
        now,
      })
    ).toMatchObject({
      status: 'OVERDUE',
      commissionPaid: false,
      paidAt: null,
      suspendedAt: null,
    })
  })

  it('restores a not-yet-due suspended settlement to pending without clearing debt', () => {
    expect(
      getWeeklySettlementAdminUpdate({
        action: 'UNSUSPEND',
        dueAt: new Date('2026-10-05T00:00:00.000Z'),
        now,
      })
    ).toMatchObject({
      status: 'PENDING',
      commissionPaid: false,
      paidAt: null,
      suspendedAt: null,
    })
  })

  it('only MARK_PAID clears the debt state', () => {
    expect(
      getWeeklySettlementAdminUpdate({
        action: 'MARK_PAID',
        dueAt: new Date('2026-09-20T00:00:00.000Z'),
        now,
      })
    ).toMatchObject({
      status: 'PAID',
      commissionPaid: true,
      paidAt: now,
      suspendedAt: null,
    })
  })
})
