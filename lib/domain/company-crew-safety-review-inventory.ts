import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { lockAndAssertAssignmentActorAuthorized } from '@/lib/domain/company-job-assignment'

const SAFETY_EVENT_TYPES = [
  'CREW_CONSUMED_PIN_SAFETY_HOLD',
  'CREW_WORKFORCE_PIN_SAFETY_HOLD',
  'WORKER_IDENTITY_MISMATCH',
] as const

/**
 * INTERNAL, read-only support evidence inventory for a safety-BLOCKED crew.
 * The caller owns a SERIALIZABLE transaction and supplies the authenticated
 * manager actor and current company context (never user-controlled identity).
 * Job -> crew locks, current roster, all historical PIN claims, witnesses and
 * the unreviewed HIGH risk queue must agree. Missing evidence DENIES review
 * readiness; a valid inventory NEVER authorizes capacity release, arrival,
 * workspace creation, work, payment or support-case resolution.
 *
 * Not wired to HTTP and deliberately has no mutation or approval operation.
 */
export async function inspectBlockedCrewSafetyEvidenceInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    crewDispatchId: string
    companyId: string
    expectedVersion: number
    actorUserId: string
    actorRole: string
  },
): Promise<{
  crewDispatchId: string
  crewVersion: number
  heldWorkerCount: number
  consumedPinClaimsPreserved: number
  witnessRecordsPreserved: number
  unreviewedHighRiskEvents: number
  manualSafetyReviewRequired: true
  independentPhysicalPresenceVerified: false
  capacityReleaseEnabled: false
  crewArrivalEnabled: false
  workStartEnabled: false
  paymentsEnabled: false
}> {
  if (!input || typeof input.crewDispatchId !== 'string' ||
      !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
      typeof input.companyId !== 'string' || !input.companyId.trim() ||
      input.companyId.length > 128 ||
      typeof input.actorUserId !== 'string' || !input.actorUserId.trim() ||
      input.actorUserId.length > 128 ||
      typeof input.actorRole !== 'string' || !input.actorRole.trim() ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new CrewCommitGateError('Invalid crew safety inventory request', 400)
  }

  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: input.crewDispatchId },
    select: { companyId: true, jobId: true },
  })
  if (!key || key.companyId !== input.companyId) {
    throw new CrewCommitGateError('Crew safety inventory not found', 404)
  }
  await lockAndAssertAssignmentActorAuthorized(
    tx, input.companyId, input.actorUserId, input.actorRole,
  )

  // Same job -> crew lock order as cancellation and safety containment.
  const jobs = await tx.$queryRaw<Array<{
    id: string; status: string; workersCount: number
  }>>`
    SELECT id, status, "workersCount" FROM "MarketplaceJob"
    WHERE id = ${key.jobId} FOR UPDATE
  `
  const crews = await tx.$queryRaw<Array<{
    id: string; companyId: string; jobId: string; status: string
    version: number; requiredWorkersCount: number; leadWorkerUserId: string | null
  }>>`
    SELECT id, "companyId", "jobId", status, version,
      "requiredWorkersCount", "leadWorkerUserId"
    FROM "CompanyCrewDispatch"
    WHERE id = ${input.crewDispatchId} FOR UPDATE
  `
  const job = jobs[0], crew = crews[0]
  if (!job || !crew || crew.id !== input.crewDispatchId ||
      crew.companyId !== input.companyId || crew.jobId !== job.id ||
      crew.status !== 'BLOCKED' || crew.version !== input.expectedVersion ||
      job.status !== 'QUOTE_ACCEPTED' ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12 ||
      job.workersCount !== crew.requiredWorkersCount) {
    throw new CrewCommitGateError('Crew safety review scope or epoch changed')
  }

  const [slots, pins, witnesses, events, workspace, legacyArrival] = await Promise.all([
    tx.companyJobAssignment.findMany({
      where: { crewDispatchId: crew.id },
      select: {
        id: true, workerUserId: true, companyId: true, jobId: true,
        status: true, crewSlot: true, crewRole: true,
        startedAt: true, crewArrivedAt: true,
      },
    }),
    tx.companyCrewPinChallenge.findMany({
      where: { crewDispatchId: crew.id },
      select: {
        id: true, assignmentId: true, jobId: true, crewVersion: true,
        purpose: true, consumedAt: true, revokedAt: true,
      },
    }),
    tx.companyCrewPresenceWitness.findMany({
      where: { crewDispatchId: crew.id },
      select: {
        id: true, assignmentId: true, jobId: true, crewDispatchId: true,
        crewVersion: true, workerUserId: true,
      },
    }),
    tx.marketplaceRiskEvent.findMany({
      where: {
        jobId: job.id, severity: 'HIGH', reviewedAt: null,
        eventType: { in: [...SAFETY_EVENT_TYPES] },
      },
      select: { id: true, eventType: true, metadata: true },
    }),
    tx.jobWorkspace.findUnique({
      where: { jobId: job.id }, select: { id: true },
    }),
    tx.jobVerificationPin.findFirst({
      where: { jobId: job.id, arrivalVerifiedAt: { not: null } },
      select: { id: true },
    }),
  ])

  const held = slots.length === crew.requiredWorkersCount &&
    new Set(slots.map(s => s.id)).size === slots.length &&
    new Set(slots.map(s => s.workerUserId)).size === slots.length &&
    new Set(slots.map(s => s.crewSlot)).size === slots.length &&
    slots.filter(s => s.crewRole === 'LEAD').length === 1 &&
    slots.find(s => s.crewRole === 'LEAD')?.workerUserId === crew.leadWorkerUserId &&
    slots.every(s => s.companyId === crew.companyId && s.jobId === job.id &&
      s.status === 'CREW_ACCEPTED' && s.crewSlot !== null &&
      s.startedAt === null && s.crewArrivedAt === null)
  if (!held || workspace || legacyArrival) {
    throw new CrewCommitGateError('Safety-held capacity or booking evidence changed')
  }

  const byAssignment = new Map(slots.map(s => [s.id, s]))
  const consumed = pins.filter(p => p.consumedAt !== null)
  if (consumed.length === 0 || pins.some(p =>
    !byAssignment.has(p.assignmentId) || p.jobId !== job.id ||
    p.purpose !== 'ARRIVAL' || p.crewVersion < 1 ||
    p.crewVersion >= crew.version ||
    (p.consumedAt !== null && p.revokedAt !== null) ||
    (p.consumedAt === null && p.revokedAt === null))) {
    throw new CrewCommitGateError('Historical arrival PIN evidence requires investigation')
  }
  const witnessScopes = new Set<string>()
  if (witnesses.some(w => {
    const slot = byAssignment.get(w.assignmentId)
    const scope = w.assignmentId + ':' + w.crewVersion
    if (witnessScopes.has(scope)) return true
    witnessScopes.add(scope)
    return !slot || w.jobId !== job.id || w.crewDispatchId !== crew.id ||
      w.workerUserId !== slot.workerUserId ||
      w.crewVersion < 1 || w.crewVersion >= crew.version
  })) {
    throw new CrewCommitGateError('Historical witness evidence requires investigation')
  }

  // Company/customer risk events use different scoped metadata keys.
  // Never expose metadata, actor identities or old PIN content in receipt.
  const linkedEvents = events.filter(event => {
    if (!event.metadata) return false
    try {
      const metadata: unknown = JSON.parse(event.metadata)
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
      const m = metadata as Record<string, unknown>
      return m.companyId === crew.companyId &&
        (m.crewDispatchId === crew.id || m.crewId === crew.id) &&
        (m.blockedVersion === undefined || m.blockedVersion === crew.version)
    } catch {
      return false
    }
  })
  if (!linkedEvents.length) {
    throw new CrewCommitGateError('Unreviewed HIGH crew safety event is missing')
  }

  return {
    crewDispatchId: crew.id,
    crewVersion: crew.version,
    heldWorkerCount: slots.length,
    consumedPinClaimsPreserved: consumed.length,
    witnessRecordsPreserved: witnesses.length,
    unreviewedHighRiskEvents: linkedEvents.length,
    manualSafetyReviewRequired: true,
    independentPhysicalPresenceVerified: false,
    capacityReleaseEnabled: false,
    crewArrivalEnabled: false,
    workStartEnabled: false,
    paymentsEnabled: false,
  }
}
