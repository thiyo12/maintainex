export type WeeklySettlementAdminAction = 'MARK_PAID' | 'SUSPEND' | 'UNSUSPEND'

export interface WeeklySettlementStateInput {
  action: WeeklySettlementAdminAction
  dueAt: Date
  now?: Date
}

export function getWeeklySettlementAdminUpdate({
  action,
  dueAt,
  now = new Date(),
}: WeeklySettlementStateInput): Record<string, unknown> {
  if (action === 'MARK_PAID') {
    return {
      commissionPaid: true,
      paidAt: now,
      status: 'PAID',
      suspendedAt: null,
    }
  }

  if (action === 'SUSPEND') {
    return {
      status: 'SUSPENDED',
      suspendedAt: now,
    }
  }

  return {
    status: dueAt < now ? 'OVERDUE' : 'PENDING',
    commissionPaid: false,
    paidAt: null,
    suspendedAt: null,
  }
}
