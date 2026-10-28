export type DisputeClaimResult =
  | { ok: true; status: 'OPEN' | 'UNDER_REVIEW'; alertId: string; claimedBy: string }
  | { ok: false; code: 'NOT_FOUND' | 'CLOSED' | 'ASSIGNED_TO_OTHER' }

/** Claim a case while holding its database row lock so two staff cannot win. */
export async function claimMarketplaceDisputeInTransaction(
  tx: any,
  input: { disputeId: string; adminId: string; adminRole: string }
): Promise<DisputeClaimResult> {
  const rows = await tx.$queryRawUnsafe(
    'SELECT id, status FROM "MarketplaceDispute" WHERE id = $1 FOR UPDATE',
    input.disputeId,
  ) as Array<{ id: string; status: string }>
  const dispute = rows[0]
  if (!dispute) return { ok: false, code: 'NOT_FOUND' }
  if (!['OPEN', 'UNDER_REVIEW'].includes(dispute.status)) {
    return { ok: false, code: 'CLOSED' }
  }

  const alerts = await tx.adminAlert.findMany({
    where: {
      targetTable: 'MarketplaceDispute',
      targetId: input.disputeId,
      status: { in: ['open', 'in_progress'] },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (alerts.some((alert: { assignedTo: string | null }) =>
    alert.assignedTo && alert.assignedTo !== input.adminId
  )) {
    return { ok: false, code: 'ASSIGNED_TO_OTHER' }
  }

  const alert = alerts[0]
  let alertId: string
  if (!alert) {
    const createdAlert = await tx.adminAlert.create({
      data: {
        type: 'dispute',
        severity: 'high',
        priority: 'high',
        title: 'Marketplace financial dispute',
        description: 'Assigned from the country-scoped Support/Finance dispute queue.',
        targetTable: 'MarketplaceDispute',
        targetId: input.disputeId,
        assignedTo: input.adminId,
        assignedRole: input.adminRole,
        status: 'in_progress',
      },
    })
    alertId = createdAlert.id
  } else {
    alertId = alert.id
    await tx.adminAlert.updateMany({
      where: {
        targetTable: 'MarketplaceDispute',
        targetId: input.disputeId,
        status: { in: ['open', 'in_progress'] },
      },
      data: {
        assignedTo: input.adminId,
        assignedRole: input.adminRole,
        status: 'in_progress',
      },
    })
  }

  if (dispute.status === 'OPEN') {
    await tx.marketplaceDispute.updateMany({
      where: { id: input.disputeId, status: 'OPEN' },
      data: { status: 'UNDER_REVIEW' },
    })
  }

  return {
    ok: true,
    status: 'UNDER_REVIEW',
    alertId,
    claimedBy: input.adminId,
  }
}
