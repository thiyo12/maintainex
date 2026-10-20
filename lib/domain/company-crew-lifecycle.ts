import { Prisma } from '@prisma/client'
import { requireJobMarket } from '@/lib/geography/market-engine'
import { checkCompanyEligibility, checkCrewCandidateEligibility } from '@/lib/phase6/provider-eligibility'
import { lockAndAssertAssignmentActorAuthorized, lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

export interface CrewWorkerDecision {
  crewDispatchId: string
  workerUserId: string // Future caller MUST bind to authenticated user.id, never request body
  expectedVersion: number
}

interface LockedCrew {
  id: string
  companyId: string
  jobId: string
  requiredWorkersCount: number
  leadWorkerUserId: string | null
  status: string
  version: number
}

interface CrewSlot {
  id: string
  companyId: string
  jobId: string
  workerUserId: string
  status: string
  crewSlot: number | null
  crewRole: string | null
}

/**
 * The job lock is acquired before the crew and worker row locks. Verify the
 * accepted company quote before reading customer booking data. Every caller
 * MUST supply its own SERIALIZABLE transaction and authenticated worker ID.
 */
async function lockCrewForDecision(tx: Prisma.TransactionClient, input: CrewWorkerDecision) {
  if (!input.crewDispatchId || input.crewDispatchId.length > 128 ||
      !input.workerUserId || input.workerUserId.length > 128 ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new CrewCommitGateError('Invalid crew decision', 400)
  }

  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: input.crewDispatchId },
    select: { companyId: true, jobId: true },
  })
  if (!key) throw new CrewCommitGateError('Crew invitation not found', 404)

  const quotes = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "JobQuote"
    WHERE "jobId" = ${key.jobId} AND "providerId" = ${key.companyId}
      AND "providerType" = 'COMPANY' AND status = 'ACCEPTED'
    FOR SHARE
  `
  if (quotes.length !== 1) throw new CrewCommitGateError('Crew invitation no longer has an accepted quote')

  const jobs = await tx.$queryRaw<Array<{
    id: string
    status: string
    workersCount: number
    countryCode: string
    latitude: number | null
    longitude: number | null
    preferredDate: Date | null
    preferredTimeSlot: string | null
    targetTaskerId: string | null
  }>>`
    SELECT id, status, "workersCount", "countryCode", latitude, longitude,
      "preferredDate", "preferredTimeSlot", "targetTaskerId"
    FROM "MarketplaceJob" WHERE id = ${key.jobId} FOR UPDATE
  `
  const job = jobs[0]
  const crews = await tx.$queryRaw<LockedCrew[]>`
    SELECT id, "companyId", "jobId", "requiredWorkersCount",
      "leadWorkerUserId", status, version
    FROM "CompanyCrewDispatch" WHERE id = ${input.crewDispatchId} FOR UPDATE
  `
  const crew = crews[0]
  if (!crew || crew.version !== input.expectedVersion || crew.status !== 'FORMING' ||
      crew.companyId !== key.companyId || crew.jobId !== key.jobId ||
      !job || job.status !== 'QUOTE_ACCEPTED' || job.workersCount !== crew.requiredWorkersCount ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) {
    throw new CrewCommitGateError('Crew version, roster size or booking status changed')
  }
  const jobMarket = requireJobMarket(job)
  const company = await tx.companyProfile.findUnique({
    where: { id: crew.companyId },
    select: { countryCode: true, userId: true },
  })
  if (!jobMarket.ok || !company || company.countryCode.trim().toUpperCase() !== jobMarket.countryCode ||
      (job.targetTaskerId && ![crew.companyId, company.userId].includes(job.targetTaskerId))) {
    throw new CrewCommitGateError('Crew market or booking target changed')
  }

  const slots: CrewSlot[] = await tx.companyJobAssignment.findMany({
    where: { crewDispatchId: crew.id },
    select: {
      id: true, companyId: true, jobId: true, workerUserId: true,
      status: true, crewSlot: true, crewRole: true,
    },
  })
  if (slots.length !== crew.requiredWorkersCount ||
    new Set(slots.map(slot => slot.workerUserId)).size !== slots.length ||
    new Set(slots.map(slot => slot.crewSlot)).size !== slots.length ||
    slots.filter(slot => slot.crewRole === 'LEAD').length !== 1 ||
    slots.find(slot => slot.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId ||
    slots.some(slot => slot.companyId !== crew.companyId ||
      slot.jobId !== crew.jobId || !slot.crewSlot ||
      !['CREW_RESERVED', 'CREW_ACCEPTED'].includes(slot.status))) {
    throw new CrewCommitGateError('Crew roster is incomplete or inconsistent')
  }
  const slot = slots.find(item => item.workerUserId === input.workerUserId)
  if (!slot) throw new CrewCommitGateError('Crew invitation not found', 404)
  return { job, crew, slot, slots }
}

/**
 * Internal per-worker response. Only the named worker can accept their own
 * still-reserved slot. No API caller exists yet. Status CREW_ACCEPTED is NOT
 * legacy ACCEPTED and never grants PIN/work-start or workspace rights.
 */
export async function acceptStagedCrewMemberInsideTransaction(
  tx: Prisma.TransactionClient,
  input: CrewWorkerDecision,
): Promise<{
  crewDispatchId: string
  acceptedWorkersCount: number
  requiredWorkersCount: number
  status: 'FORMING'
  dispatchEnabled: false
}> {
  const { crew, job, slot, slots } = await lockCrewForDecision(tx, input)
  if (slot.status !== 'CREW_RESERVED') {
    throw new CrewCommitGateError('Crew invitation has already been answered')
  }
  const company = await checkCompanyEligibility(crew.companyId, tx)
  if (!company.eligible) throw new CrewCommitGateError('Company is no longer eligible')

  await lockAndAssertWorkerScheduleAvailable(
    tx, input.workerUserId, crew.jobId,
    job.preferredDate, job.preferredTimeSlot, crew.companyId, true,
  )
  const eligibility = await checkCrewCandidateEligibility(
    crew.companyId, input.workerUserId, crew.jobId, tx,
  )
  if (!eligibility.eligible) {
    throw new CrewCommitGateError('Worker is no longer eligible for this crew')
  }
  const [arrival, mismatch] = await Promise.all([
    tx.jobVerificationPin.findFirst({
      where: { jobId: crew.jobId, arrivalVerifiedAt: { not: null } },
      select: { id: true },
    }),
    tx.jobWorkerIdentityCheck.findFirst({
      where: { jobId: crew.jobId, status: { in: ['MISMATCH_REPORTED', 'REVIEW_REQUIRED'] } },
      select: { id: true },
    }),
  ])
  if (arrival || mismatch) throw new CrewCommitGateError('Arrival or safety review blocks crew acceptance')

  const claimed = await tx.companyJobAssignment.updateMany({
    where: {
      id: slot.id, companyId: crew.companyId, jobId: crew.jobId,
      workerUserId: input.workerUserId,
      crewDispatchId: crew.id, status: 'CREW_RESERVED',
    },
    data: { status: 'CREW_ACCEPTED', acceptedAt: new Date() },
  })
  if (claimed.count !== 1) throw new CrewCommitGateError('Crew invitation changed concurrently')
  await writeCompanyAuditLog({
    companyId: crew.companyId, actorId: input.workerUserId, actorRole: 'WORKER',
    action: 'CREW_MEMBER_ACCEPT',
    targetType: 'CompanyJobAssignment', targetId: slot.id,
    description: 'Worker accepted internal staged crew slot, not authorized to start work',
    metadata: { jobId: crew.jobId, crewId: crew.id, crewVersion: crew.version },
  }, tx)
  // Count under the same transaction. The crew intentionally remains FORMING,
  // even if everybody has accepted. Identity and PIN barriers are outstanding.
  return {
    crewDispatchId: crew.id,
    acceptedWorkersCount: slots.filter(item => item.status === 'CREW_ACCEPTED').length + 1,
    requiredWorkersCount: crew.requiredWorkersCount,
    status: 'FORMING',
    dispatchEnabled: false,
  }
}

/**
 * A refusal invalidates the entire still-FORMING crew epoch atomically.
 * The refusing member is REJECTED; all other reserved/accepted members are
 * REVOKED, releasing their scheduling holds together. The crew moves to
 * BLOCKED with a new version so no stale acceptance can succeed.
 *
 * Does not erase identity mismatch/safety evidence and cannot authorize
 * work. There is no HTTP caller; a future route MUST pass authenticated
 * workerUserId and run this inside a SERIALIZABLE transaction.
 */
export async function rejectStagedCrewMemberInsideTransaction(
  tx: Prisma.TransactionClient,
  input: CrewWorkerDecision & { reason?: string },
): Promise<{
  crewDispatchId: string
  status: 'BLOCKED'
  version: number
  releasedWorkersCount: number
  dispatchEnabled: false
}> {
  if (input.reason !== undefined &&
      (typeof input.reason !== 'string' || input.reason.length > 250)) {
    throw new CrewCommitGateError('Invalid crew refusal reason', 400)
  }
  const { crew, slot, slots } = await lockCrewForDecision(tx, input)
  if (!['CREW_RESERVED', 'CREW_ACCEPTED'].includes(slot.status)) {
    throw new CrewCommitGateError('Crew invitation has already been answered')
  }

  // Serialize an account closure with refusal; unlike acceptance, a blocked
  // member must still be permitted to relinquish an outstanding reservation.
  const accounts = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "User" WHERE id = ${input.workerUserId} FOR UPDATE
  `
  if (accounts.length !== 1) throw new CrewCommitGateError('Worker account no longer exists')

  const now = new Date()
  const rejected = await tx.companyJobAssignment.updateMany({
    where: {
      id: slot.id, companyId: crew.companyId, jobId: crew.jobId,
      workerUserId: input.workerUserId,
      crewDispatchId: crew.id, status: slot.status,
    },
    data: {
      status: 'REJECTED',
      rejectedAt: now,
      rejectReason: input.reason?.trim() || 'Worker declined crew invitation',
    },
  })
  if (rejected.count !== 1) {
    throw new CrewCommitGateError('Crew invitation changed concurrently')
  }
  const released = await tx.companyJobAssignment.updateMany({
    where: {
      crewDispatchId: crew.id,
      id: { not: slot.id },
      status: { in: ['CREW_RESERVED', 'CREW_ACCEPTED'] },
    },
    data: {
      status: 'REVOKED',
      revokedAt: now,
      revokedReason: 'Crew blocked by worker refusal',
    },
  })
  if (released.count !== slots.length - 1) {
    throw new CrewCommitGateError('Crew slots changed during refusal')
  }
  const blocked = await tx.companyCrewDispatch.updateMany({
    where: { id: crew.id, status: 'FORMING', version: crew.version },
    data: { status: 'BLOCKED', version: { increment: 1 } },
  })
  if (blocked.count !== 1) {
    throw new CrewCommitGateError('Crew version changed during refusal')
  }
  await writeCompanyAuditLog({
    companyId: crew.companyId,
    actorId: input.workerUserId, actorRole: 'WORKER',
    action: 'CREW_MEMBER_REJECT',
    targetType: 'CompanyCrewDispatch', targetId: crew.id,
    description: 'Worker refused staged crew and all slots were released',
    metadata: { jobId: crew.jobId, oldCrewVersion: crew.version },
  }, tx)
  return {
    crewDispatchId: crew.id,
    status: 'BLOCKED',
    version: crew.version + 1,
    releasedWorkersCount: slots.length,
    dispatchEnabled: false,
  }
}

// A manager may safely abandon a still-FORMING roster. Cancellation is a
// terminal epoch: the unique jobId crew row is retained for traceability, so
// refilling requires a separate, audited versioned roster protocol.
export async function cancelStagedCrewInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    crewDispatchId: string
    actorUserId: string // authenticated actor, NEVER copied from the request body
    actorRole: string
    expectedVersion: number
    reason?: string
  },
): Promise<{
  crewDispatchId: string
  status: 'CANCELLED'
  version: number
  releasedWorkersCount: number
  dispatchEnabled: false
}> {
  if (!input.crewDispatchId || input.crewDispatchId.length > 128 ||
      !input.actorUserId || input.actorUserId.length > 128 ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      (input.reason !== undefined &&
        (typeof input.reason !== 'string' || input.reason.length > 250))) {
    throw new CrewCommitGateError('Invalid crew cancellation request', 400)
  }

  // Resolve only the crew's company/job keys before authorizing the actor.
  // Do not reveal customer or worker details until the current company role
  // has been locked and checked under the same SERIALIZABLE transaction.
  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: input.crewDispatchId },
    select: { companyId: true, jobId: true },
  })
  if (!key) throw new CrewCommitGateError('Crew roster not found', 404)
  await lockAndAssertAssignmentActorAuthorized(
    tx, key.companyId, input.actorUserId, input.actorRole,
  )

  const jobs = await tx.$queryRaw<Array<{ id: string; status: string; workersCount: number }>>`
    SELECT id, status, "workersCount"
    FROM "MarketplaceJob" WHERE id = ${key.jobId} FOR UPDATE
  `
  const crews = await tx.$queryRaw<LockedCrew[]>`
    SELECT id, "companyId", "jobId", "requiredWorkersCount",
      "leadWorkerUserId", status, version
    FROM "CompanyCrewDispatch" WHERE id = ${input.crewDispatchId} FOR UPDATE
  `
  const crew = crews[0]
  if (!crew || crew.companyId !== key.companyId || crew.jobId !== key.jobId ||
      crew.version !== input.expectedVersion || crew.status !== 'FORMING' ||
      jobs[0]?.status !== 'QUOTE_ACCEPTED' ||
      jobs[0]?.workersCount !== crew.requiredWorkersCount) {
    throw new CrewCommitGateError('Crew or booking changed; cannot cancel stale roster')
  }
  // Neither identity confirmations nor arrival evidence may be erased. A
  // prior arrival is a safety event, even if crew statuses still say FORMING.
  const priorArrival = await tx.jobVerificationPin.findFirst({
    where: { jobId: crew.jobId, arrivalVerifiedAt: { not: null } },
    select: { id: true },
  })
  const activePin = await tx.jobVerificationPin.findFirst({
    where: { jobId: crew.jobId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (priorArrival || activePin) {
    throw new CrewCommitGateError('PIN or arrival evidence blocks silent crew cancellation')
  }
  const slots = await tx.companyJobAssignment.findMany({
    where: { crewDispatchId: crew.id },
    select: {
      id: true, companyId: true, jobId: true, status: true,
      workerUserId: true, crewSlot: true, crewRole: true,
      startedAt: true, crewArrivedAt: true,
    },
  })
  if (slots.length !== crew.requiredWorkersCount ||
      slots.some(slot => slot.companyId !== crew.companyId ||
        slot.jobId !== crew.jobId ||
        !['CREW_RESERVED', 'CREW_ACCEPTED'].includes(slot.status) ||
        slot.startedAt !== null || slot.crewArrivedAt !== null) ||
      new Set(slots.map(slot => slot.workerUserId)).size !== slots.length ||
      new Set(slots.map(slot => slot.crewSlot)).size !== slots.length ||
      slots.filter(slot => slot.crewRole === 'LEAD').length !== 1 ||
      slots.find(slot => slot.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId) {
    throw new CrewCommitGateError('Crew roster is not safe to cancel')
  }

  const now = new Date()
  const released = await tx.companyJobAssignment.updateMany({
    where: { crewDispatchId: crew.id, status: { in: ['CREW_RESERVED', 'CREW_ACCEPTED'] } },
    data: {
      status: 'REVOKED', revokedAt: now,
      revokedReason: input.reason?.trim() || 'Crew roster cancelled by dispatcher',
    },
  })
  if (released.count !== slots.length) {
    throw new CrewCommitGateError('Crew roster changed during cancellation')
  }
  const updated = await tx.companyCrewDispatch.updateMany({
    where: { id: crew.id, status: 'FORMING', version: crew.version },
    data: { status: 'CANCELLED', version: { increment: 1 } },
  })
  if (updated.count !== 1) throw new CrewCommitGateError('Crew version changed during cancellation')
  await writeCompanyAuditLog({
    companyId: crew.companyId,
    actorId: input.actorUserId,
    actorRole: input.actorRole,
    action: 'CREW_ROSTER_CANCEL',
    targetType: 'CompanyCrewDispatch',
    targetId: crew.id,
    description: 'Dispatcher cancelled staged crew; all capacity released, no work authorized',
    metadata: { jobId: crew.jobId, oldCrewVersion: crew.version, releasedWorkersCount: released.count },
  }, tx)
  return {
    crewDispatchId: crew.id, status: 'CANCELLED',
    version: crew.version + 1,
    releasedWorkersCount: released.count,
    dispatchEnabled: false,
  }
}
