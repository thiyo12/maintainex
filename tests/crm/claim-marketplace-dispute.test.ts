import { describe, expect, it, vi } from 'vitest'
import { claimMarketplaceDisputeInTransaction } from '@/lib/crm/disputes/claim-marketplace-dispute'

function fakeTx(status = 'OPEN', existingAlert?: { id: string; assignedTo: string | null }) {
  return {
    $queryRawUnsafe: vi.fn(async () => [{ id: 'case-1', status }]),
    marketplaceDispute: { updateMany: vi.fn(async () => ({ count: 1 })) },
    adminAlert: {
      findFirst: vi.fn(async () => existingAlert ?? null),
      create: vi.fn(async ({ data }: any) => ({ id: 'alert-1', ...data })),
      update: vi.fn(async () => undefined),
    },
  }
}

describe('marketplace financial case assignment', () => {
  it('locks the case, claims the queue item and moves an open case into review', async () => {
    const tx = fakeTx()
    const result = await claimMarketplaceDisputeInTransaction(tx, {
      disputeId: 'case-1', adminId: 'finance-1', adminRole: 'FINANCE',
    })

    expect(result).toEqual({ ok: true, status: 'UNDER_REVIEW', alertId: 'alert-1', claimedBy: 'finance-1' })
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id, status FROM "MarketplaceDispute" WHERE id = $1 FOR UPDATE', 'case-1',
    )
    expect(tx.adminAlert.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      targetTable: 'MarketplaceDispute', targetId: 'case-1', assignedTo: 'finance-1',
      assignedRole: 'FINANCE', status: 'in_progress',
    }) })
    expect(tx.marketplaceDispute.updateMany).toHaveBeenCalledWith({
      where: { id: 'case-1', status: 'OPEN' }, data: { status: 'UNDER_REVIEW' },
    })
  })

  it('does not steal a case assigned to another staff member', async () => {
    const tx = fakeTx('UNDER_REVIEW', { id: 'alert-other', assignedTo: 'support-2' })
    const result = await claimMarketplaceDisputeInTransaction(tx, {
      disputeId: 'case-1', adminId: 'finance-1', adminRole: 'FINANCE',
    })

    expect(result).toEqual({ ok: false, code: 'ASSIGNED_TO_OTHER' })
    expect(tx.adminAlert.update).not.toHaveBeenCalled()
    expect(tx.adminAlert.create).not.toHaveBeenCalled()
    expect(tx.marketplaceDispute.updateMany).not.toHaveBeenCalled()
  })

  it('rejects closed cases without changing assignment or status', async () => {
    const tx = fakeTx('RESOLVED')
    const result = await claimMarketplaceDisputeInTransaction(tx, {
      disputeId: 'case-1', adminId: 'finance-1', adminRole: 'FINANCE',
    })
    expect(result).toEqual({ ok: false, code: 'CLOSED' })
    expect(tx.adminAlert.findFirst).not.toHaveBeenCalled()
  })
})
