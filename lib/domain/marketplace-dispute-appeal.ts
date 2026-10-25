import { resolveMarketplaceDisputeParticipant } from '@/lib/domain/marketplace-dispute-participants'

type AppealResult =
  | { ok: true; status: string; replayed: boolean }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_PARTICIPANT' | 'NOT_RESOLVED' | 'IDEMPOTENCY_CONFLICT' }

function readMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

/** Reopen a resolved dispute for review without changing any financial balance. */
export async function appealMarketplaceDisputeInTransaction(
  tx: any,
  input: {
    disputeId: string
    actorId: string
    appeal: string
    idempotencyKey: string
  },
): Promise<AppealResult> {
  const rows = await tx.$queryRawUnsafe(
    'SELECT id, "jobId", status, resolution, "resolutionAction", "resolvedBy", "resolvedAt" FROM "MarketplaceDispute" WHERE id = $1 FOR UPDATE',
    input.disputeId,
  ) as Array<{
    id: string
    jobId: string
    status: string
    resolution: string | null
    resolutionAction: string | null
    resolvedBy: string | null
    resolvedAt: Date | null
  }>
  const current = rows[0]
  if (!current) return { ok: false, code: 'NOT_FOUND' }

  const actorType = await resolveMarketplaceDisputeParticipant(tx, current.jobId, input.actorId)
  if (!actorType) return { ok: false, code: 'NOT_PARTICIPANT' }

  const priorAppeals = await tx.jobLifecycleEvent.findMany({
    where: { jobId: current.jobId, action: 'FINANCIAL_DISPUTE_APPEALED' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  }) as Array<{ metadata: string | null }>
  const prior = priorAppeals.find(event => {
    const metadata = readMetadata(event.metadata)
    return metadata?.disputeId === input.disputeId &&
      metadata?.actorId === input.actorId &&
      metadata?.idempotencyKey === input.idempotencyKey
  })
  if (prior) return { ok: true, status: current.status, replayed: true }

  if (current.status !== 'RESOLVED') {
    return { ok: false, code: current.status === 'OPEN' ? 'IDEMPOTENCY_CONFLICT' : 'NOT_RESOLVED' }
  }

  const changed = await tx.marketplaceDispute.updateMany({
    where: { id: input.disputeId, status: 'RESOLVED' },
    data: {
      status: 'OPEN',
      resolution: null,
      resolutionAction: null,
      resolvedBy: null,
      resolvedAt: null,
    },
  })
  if (changed.count !== 1) return { ok: false, code: 'NOT_RESOLVED' }

  await tx.jobLifecycleEvent.create({
    data: {
      jobId: current.jobId,
      actorId: input.actorId,
      actorType,
      action: 'FINANCIAL_DISPUTE_APPEALED',
      fromState: 'RESOLVED',
      toState: 'OPEN',
      metadata: JSON.stringify({
        disputeId: input.disputeId,
        actorId: input.actorId,
        idempotencyKey: input.idempotencyKey,
        appeal: input.appeal,
        previousResolution: current.resolution,
        previousResolutionAction: current.resolutionAction,
        previousResolvedBy: current.resolvedBy,
        previousResolvedAt: current.resolvedAt?.toISOString() ?? null,
        financialEffect: 'NONE',
      }),
    },
  })

  const activeAlerts = await tx.adminAlert.findMany({
    where: {
      targetTable: 'MarketplaceDispute',
      targetId: input.disputeId,
      status: { in: ['open', 'in_progress'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (activeAlerts.length) {
    await tx.adminAlert.updateMany({
      where: { id: { in: activeAlerts.map((alert: { id: string }) => alert.id) } },
      data: {
        status: 'open',
        assignedTo: null,
        assignedRole: 'SUPPORT',
        resolvedAt: null,
        resolvedBy: null,
        title: 'Financial dispute appeal',
        description: 'A participant appealed a resolved financial dispute. Review case history; no funds were moved by the appeal.',
      },
    })
  } else {
    await tx.adminAlert.create({
      data: {
        type: 'dispute',
        severity: 'high',
        priority: 'high',
        title: 'Financial dispute appeal',
        description: 'A participant appealed a resolved financial dispute. Review case history; no funds were moved by the appeal.',
        targetTable: 'MarketplaceDispute',
        targetId: input.disputeId,
        assignedRole: 'SUPPORT',
        status: 'open',
      },
    })
  }

  return { ok: true, status: 'OPEN', replayed: false }
}
