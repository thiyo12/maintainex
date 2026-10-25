export type MarketplaceDisputeResolutionAction = 'RELEASE_PROVIDER' | 'REFUND_CUSTOMER'

export async function finalizeMarketplaceDisputeInTransaction(
  tx: any,
  input: {
    disputeId: string
    adminId: string
    resolution: string
    resolutionAction: MarketplaceDisputeResolutionAction
  }
) {
  const rows = await tx.$queryRawUnsafe(
    'SELECT id, "jobId", status, "resolutionAction" FROM "MarketplaceDispute" WHERE id = $1 FOR UPDATE',
    input.disputeId,
  ) as Array<{ id: string; jobId: string; status: string; resolutionAction: string | null }>
  const current = rows[0]
  if (!current) throw new Error('MARKETPLACE_DISPUTE_NOT_FOUND')

  if (current.status === 'RESOLVED') {
    if (current.resolutionAction !== input.resolutionAction) {
      throw new Error('MARKETPLACE_DISPUTE_RESOLUTION_CONFLICT')
    }
    return tx.marketplaceDispute.findUniqueOrThrow({ where: { id: input.disputeId } })
  }
  if (current.status !== 'RESOLVING') throw new Error('MARKETPLACE_DISPUTE_STATE_CHANGED')

  const resolvedAt = new Date()
  const updatedCount = await tx.marketplaceDispute.updateMany({
    where: { id: input.disputeId, status: 'RESOLVING' },
    data: {
      status: 'RESOLVED',
      resolution: input.resolution,
      resolutionAction: input.resolutionAction,
      resolvedBy: input.adminId,
      resolvedAt,
    },
  })
  if (updatedCount.count !== 1) throw new Error('MARKETPLACE_DISPUTE_STATE_CHANGED')

  await tx.jobLifecycleEvent.create({
    data: {
      jobId: current.jobId,
      actorId: input.adminId,
      actorType: 'STAFF',
      action: 'FINANCIAL_DISPUTE_RESOLVED',
      fromState: 'RESOLVING',
      toState: 'RESOLVED',
      metadata: JSON.stringify({
        disputeId: input.disputeId,
        resolutionAction: input.resolutionAction,
        resolution: input.resolution,
      }),
    },
  })

  await tx.adminAlert.updateMany({
    where: {
      targetTable: 'MarketplaceDispute',
      targetId: input.disputeId,
      status: { in: ['open', 'in_progress'] },
    },
    data: {
      status: 'resolved',
      resolvedAt,
      resolvedBy: input.adminId,
      notes: input.resolution,
    },
  })

  return tx.marketplaceDispute.findUniqueOrThrow({ where: { id: input.disputeId } })
}
