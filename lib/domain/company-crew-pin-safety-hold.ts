import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { lockAndAssertAssignmentActorAuthorized } from '@/lib/domain/company-job-assignment'
import { revokeCrewPinChallengesInsideTransaction } from '@/lib/domain/company-crew-pin-revocation'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

/**
 * Internal safety containment for a FORMING crew with at least one consumed
 * per-worker arrival PIN. The manager cannot silently cancel and release
 * coworkers when a person has claimed to be on site.
 *
 * In the SAME caller-owned SERIALIZABLE transaction:
 * - lock current manager membership, booking, crew version and all assignments
 * - revoke all UNCONSUMED arrival challenges, never erase consumed PIN or
 *   customer/worker witness evidence
 * - increment crew epoch and block any further PIN/identity/work transitions
 * - HOLD ALL accepted worker capacity for human support investigation
 * - log a durable safety-review audit record
 *
 * NO HTTP route. This is neither a roster cancellation, nor permission to
 * show up, mark arrival/READY, work, pay, refund or release capacity.
 * No automatic retry is permitted after a serialization conflict.
 */
export async function holdCrewAfterPinClaimInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    crewDispatchId: string
    companyId: string
    expectedVersion: number
    actorUserId: string
    actorRole: string
    reason: string
  },
): Promise<{
  crewDispatchId: string
  crewVersion: number
  status: 'BLOCKED'
  preservedConsumedPinClaims: number
  revokedUnusedPinChallenges: number
  capacityHeldWorkerCount: number
  supportReviewRequired: true
  physicalPresenceVerified: false
  arrivalEnabled: false
  workStartEnabled: false
  paymentsEnabled: false
}> {
  if (!input || typeof input.crewDispatchId !== 'string' ||
      !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
      typeof input.companyId !== 'string' || !input.companyId.trim() ||
      input.companyId.length > 128 ||
      typeof input.actorUserId !== 'string' || !input.actorUserId.trim() ||
      input.actorUserId.length > 128 ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      typeof input.actorRole !== 'string' || !input.actorRole.trim() ||
      typeof input.reason !== 'string' || !input.reason.trim() ||
      input.reason.trim().length > 250) {
    throw new CrewCommitGateError('Invalid crew safety review request', 400)
  }
  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: input.crewDispatchId },
    select: { companyId: true, jobId: true },
  })
  if (!key || key.companyId !== input.companyId) {
    throw new CrewCommitGateError('Crew booking not found', 404)
  }
  await lockAndAssertAssignmentActorAuthorized(
    tx, key.companyId, input.actorUserId, input.actorRole,
  )
  const jobs = await tx.$queryRaw<Array<{
    id: string; status: string; workersCount: number
  }>>\`
    SELECT id, status, "workersCount" FROM "MarketplaceJob"
    WHERE id = \${key.jobId} FOR UPDATE
  \`
  const crews = await tx.$queryRaw<Array<{
    id: string; companyId: string; jobId: string
    version: number; status: string; requiredWorkersCount: number
    leadWorkerUserId: string | null
  }>>\`
    SELECT id, "companyId", "jobId", version, status,
      "requiredWorkersCount", "leadWorkerUserId"
    FROM "CompanyCrewDispatch" WHERE id = \${input.crewDispatchId} FOR UPDATE
  \`
  const crew = crews[0], job = jobs[0]
  if (!crew || !job || crew.companyId !== key.companyId ||
      crew.jobId !== key.jobId ||
      crew.version !== input.expectedVersion ||
      crew.status !== 'FORMING' || job.status !== 'QUOTE_ACCEPTED' ||
      job.workersCount !== crew.requiredWorkersCount ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) {
    throw new CrewCommitGateError('Crew epoch or booking changed before safety hold')
  }
  const [slots, legacyArrival, activeLegacyPin, workspace] = await Promise.all([
    tx.companyJobAssignment.findMany({
      where: { crewDispatchId: crew.id },
      select: {
        id: true, companyId: true, jobId: true, workerUserId: true,
        crewSlot: true, crewRole: true, status: true,
        startedAt: true, crewArrivedAt: true,
      },
    }),
    tx.jobVerificationPin.findFirst({
      where: { jobId: crew.jobId, arrivalVerifiedAt: { not: null } },
      select: { id: true },
    }),
    tx.jobVerificationPin.findFirst({
      where: { jobId: crew.jobId, status: 'ACTIVE' },
      select: { id: true },
    }),
    tx.jobWorkspace.findUnique({
      where: { jobId: crew.jobId }, select: { id: true },
    }),
  ])
  if (legacyArrival || activeLegacyPin || workspace ||
      slots.length !== crew.requiredWorkersCount ||
      new Set(slots.map(s => s.workerUserId)).size !== slots.length ||
      new Set(slots.map(s => s.crewSlot)).size !== slots.length ||
      slots.filter(s => s.crewRole === 'LEAD').length !== 1 ||
      slots.find(s => s.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId ||
      slots.some(s => s.companyId !== crew.companyId ||
        s.jobId !== crew.jobId || !s.crewSlot ||
        s.status !== 'CREW_ACCEPTED' ||
        s.crewArrivedAt !== null || s.startedAt !== null)) {
    throw new CrewCommitGateError('Crew is not safe for prestart containment')
  }
  const claims = await tx.companyCrewPinChallenge.findMany({
    where: { crewDispatchId: crew.id, crewVersion: crew.version },
    select: {
      id: true, jobId: true, assignmentId: true,
      consumedAt: true, revokedAt: true, purpose: true,
    },
  })
  const assignmentIds = new Set(slots.map(s => s.id))
  if (!claims.length || claims.some(c => c.jobId !== job.id ||
        !assignmentIds.has(c.assignmentId) || c.purpose !== 'ARRIVAL') ||
      claims.filter(c => c.consumedAt !== null).length === 0) {
    throw new CrewCommitGateError('Safety hold requires a current consumed arrival claim')
  }
  // All already-consumed challenges are immutable audit evidence. Later
  // cancellation/worker removal must NOT release schedule capacity silently.
  const revoked = await revokeCrewPinChallengesInsideTransaction(tx, {
    crewDispatchId: crew.id, crewVersion: crew.version,
    allowConsumedEvidence: true,
  })
  if (revoked.consumedClaimsPreserved !==
      claims.filter(c => c.consumedAt !== null).length) {
    throw new CrewCommitGateError('Crew PIN evidence changed during safety hold')
  }
  const changed = await tx.companyCrewDispatch.updateMany({
    where: { id: crew.id, status: 'FORMING', version: crew.version },
    data: { status: 'BLOCKED', version: { increment: 1 } },
  })
  if (changed.count !== 1) {
    throw new CrewCommitGateError('Crew epoch changed during safety hold')
  }
  await writeCompanyAuditLog({
    companyId: crew.companyId,
    actorId: input.actorUserId, actorRole: input.actorRole,
    action: 'CREW_PIN_SAFETY_HOLD',
    targetType: 'CompanyCrewDispatch', targetId: crew.id,
    description: 'Crew held for human safety review after PIN use; accepted capacity and evidence preserved',
    metadata: {
      jobId: crew.jobId, previousVersion: crew.version,
      newVersion: crew.version + 1, reason: input.reason.trim(),
      consumedPinsPreserved: revoked.consumedClaimsPreserved,
      unusedPinsRevoked: revoked.revokedPinChallenges,
      capacityHeld: slots.length,
    },
  }, tx)
  return {
    crewDispatchId: crew.id, crewVersion: crew.version + 1,
    status: 'BLOCKED',
    preservedConsumedPinClaims: revoked.consumedClaimsPreserved,
    revokedUnusedPinChallenges: revoked.revokedPinChallenges,
    capacityHeldWorkerCount: slots.length,
    supportReviewRequired: true,
    physicalPresenceVerified: false,
    arrivalEnabled: false,
    workStartEnabled: false,
    paymentsEnabled: false,
  }
}
