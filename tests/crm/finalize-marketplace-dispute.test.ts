import { describe, expect, it, vi } from 'vitest'
import { finalizeMarketplaceDisputeInTransaction } from '@/lib/crm/disputes/finalize-marketplace-dispute'

function fakeTx(status = 'RESOLVING', resolutionAction: string | null = 'REFUND_CUSTOMER') {
  const current = { id: 'case-1', jobId: 'job-1', status, resolutionAction }
  const updated = { ...current, status: 'RESOLVED', resolution: 'Reviewed', resolvedBy: 'finance-1' }
  return {
    $queryRawUnsafe: vi.fn(async () => [current]),
    marketplaceDispute: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => updated),
    },
    jobLifecycleEvent: { create: vi.fn(async () => ({ id: 'event-1' })) },
    adminAlert: { updateMany: vi.fn(async () => ({ count: 1 })) },
  }
}

describe('financial dispute finalization', () => {
  it('atomically closes the queue item and appends the resolution to job history', async () => {
    const tx = fakeTx()
    const result = await finalizeMarketplaceDisputeInTransaction(tx, {
      disputeId: 'case-1', adminId: 'finance-1', resolution: 'Reviewed', resolutionAction: 'REFUND_CUSTOMER',
    })
    expect(result.status).toBe('RESOLVED')
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id, "jobId", status, "resolutionAction" FROM "MarketplaceDispute" WHERE id = $1 FOR UPDATE', 'case-1',
    )
    expect(tx.marketplaceDispute.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'case-1', status: 'RESOLVING' },
      data: expect.objectContaining({ status: 'RESOLVED', resolutionAction: 'REFUND_CUSTOMER', resolvedBy: 'finance-1' }),
    }))
    expect(tx.jobLifecycleEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      jobId: 'job-1', actorId: 'finance-1', action: 'FINANCIAL_DISPUTE_RESOLVED',
      fromState: 'RESOLVING', toState: 'RESOLVED',
    }) })
    expect(tx.adminAlert.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ targetId: 'case-1' }),
      data: expect.objectContaining({ status: 'resolved', resolvedBy: 'finance-1' }),
    }))
  })

  it('replays the same resolution without adding another financial decision', async () => {
    const tx = fakeTx('RESOLVED', 'REFUND_CUSTOMER')
    await finalizeMarketplaceDisputeInTransaction(tx, {
      disputeId: 'case-1', adminId: 'finance-2', resolution: 'Second request', resolutionAction: 'REFUND_CUSTOMER',
    })
    expect(tx.jobLifecycleEvent.create).not.toHaveBeenCalled()
    expect(tx.marketplaceDispute.updateMany).not.toHaveBeenCalled()
  })

  it('rejects changing the financial outcome of a resolved case', async () => {
    const tx = fakeTx('RESOLVED', 'RELEASE_PROVIDER')
    await expect(finalizeMarketplaceDisputeInTransaction(tx, {
      disputeId: 'case-1', adminId: 'finance-2', resolution: 'Different result', resolutionAction: 'REFUND_CUSTOMER',
    })).rejects.toThrow('MARKETPLACE_DISPUTE_RESOLUTION_CONFLICT')
    expect(tx.jobLifecycleEvent.create).not.toHaveBeenCalled()
  })
})
