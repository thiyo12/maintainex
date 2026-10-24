import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireJobMarket } from '@/lib/geography/market-engine'
import { checkCompanyEligibility, checkCrewCandidateEligibility } from '@/lib/phase6/provider-eligibility'
import { lockAndAssertAssignmentActorAuthorized, lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'
import { MAX_CREW_PREVIEW_WORKERS } from '@/lib/domain/company-crew-readiness'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

export class CrewCommitGateError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message)
    this.name = 'CrewCommitGateError'
  }
}

export interface CrewCommitGateInput {
  companyId: string
  jobId: string
  actorUserId: string
  actorRole: string
  workerUserIds: string[]
}

export interface CrewCommitGateResult {
  companyId: string
  jobId: string
  requiredWorkersCount: number
  workerUserIds: string[]
  readyForFutureReservation: true
  dispatchEnabled: false
}

function validateRoster(workerUserIds: string[]): string[] {
  if (!Array.isArray(workerUserIds) || workerUserIds.length < 2 ||
    workerUserIds.length > MAX_CREW_PREVIEW_WORKERS ||
    workerUserIds.some(id => typeof id !== 'string' || !id.trim() ||
      id !== id.trim() || id.length > 128) ||
    new Set(workerUserIds).size !== workerUserIds.length) {
    throw new CrewCommitGateError('Crew requires 2–12 distinct valid worker IDs', 400)
  }
  return [...workerUserIds].sort()
}

/**
 * Read-only, point-in-time diagnostic. Its transaction COMMITS before it
 * returns; a success must NEVER be used to authorize a subsequent write.
 * There is no HTTP route and no crew dispatch activation.
 */
export async function checkCrewRosterAtCommit(
  input: CrewCommitGateInput,
): Promise<CrewCommitGateResult> {
  validateRoster(input.workerUserIds)
  return prisma.$transaction(
    tx => assertCrewRosterReadyInsideTransaction(tx, input),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

/**
 * Commit-time gate for the eventual atomic reservation writer.
 * Its caller MUST hold one SERIALIZABLE transaction open while writing
 * every reserved worker slot, and retry or fail closed on serialization
 * errors. Do not call this as a separate preflight transaction.
 * This helper itself makes no writes, creates no assignments or PINs,
 * and does not enable crew dispatch.
 */
export async function assertCrewRosterReadyInsideTransaction(
  tx: Prisma.TransactionClient,
  input: CrewCommitGateInput,
): Promise<CrewCommitGateResult> {
  const { companyId, jobId, actorUserId, actorRole } = input
  // Shared across read-only and future writer paths; lock all workers in
  // deterministic order to avoid A→B vs B→A deadlocks.
  const sortedWorkers = validateRoster(input.workerUserIds)
    await lockAndAssertAssignmentActorAuthorized(
      tx, companyId, actorUserId, actorRole,
    )

    // The accepted quote is checked before the job is retrieved to prevent
    // an authorized manager probing unrelated bookings by guessed job IDs.
    const quotes = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "JobQuote"
      WHERE "jobId" = ${jobId} AND "providerId" = ${companyId}
        AND "providerType" = 'COMPANY' AND "status" = 'ACCEPTED'
      FOR SHARE
    `
    if (quotes.length !== 1) {
      throw new CrewCommitGateError('Accepted company booking not found', 404)
    }

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
      SELECT id, status, "workersCount", "countryCode", latitude,
        longitude, "preferredDate", "preferredTimeSlot", "targetTaskerId"
      FROM "MarketplaceJob" WHERE id = ${jobId} FOR UPDATE
    `
    const job = jobs[0]
    if (!job || job.status !== 'QUOTE_ACCEPTED' ||
      job.workersCount !== sortedWorkers.length ||
      job.workersCount < 2 || job.workersCount > MAX_CREW_PREVIEW_WORKERS) {
      throw new CrewCommitGateError('Crew size or booking status changed before commit')
    }

    const companies = await tx.$queryRaw<Array<{ id: string; countryCode: string; userId: string }>>`
      SELECT id, "countryCode", "userId"
      FROM "CompanyProfile" WHERE id = ${companyId} FOR UPDATE
    `
    const company = companies[0]
    const market = requireJobMarket(job)
    if (!company || !market.ok ||
      company.countryCode.trim().toUpperCase() !== market.countryCode) {
      throw new CrewCommitGateError('Company and booking service markets do not match')
    }
    if (job.targetTaskerId && ![
      companyId, company.userId,
    ].includes(job.targetTaskerId)) {
      throw new CrewCommitGateError('Booking is already targeted to an individual worker')
    }
    const companyEligibility = await checkCompanyEligibility(companyId, tx)
    if (!companyEligibility.eligible) {
      throw new CrewCommitGateError('Company is no longer eligible for crew dispatch')
    }

    const [activeAssignment, existingCrew, priorArrival, activePin, safetyMismatch] = await Promise.all([
      tx.companyJobAssignment.findFirst({
        where: { jobId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
        select: { id: true },
      }),
      tx.companyCrewDispatch.findUnique({ where: { jobId }, select: { id: true } }),
      tx.jobVerificationPin.findFirst({
        where: { jobId, arrivalVerifiedAt: { not: null } },
        select: { id: true },
      }),
      tx.jobVerificationPin.findFirst({
        where: { jobId, status: 'ACTIVE' },
        select: { id: true },
      }),
      tx.jobWorkerIdentityCheck.findFirst({
        where: { jobId, status: { in: ['MISMATCH_REPORTED', 'REVIEW_REQUIRED'] } },
        select: { id: true },
      }),
    ])
    if (activeAssignment || existingCrew || priorArrival || activePin || safetyMismatch) {
      throw new CrewCommitGateError('Booking has existing dispatch, arrival or unresolved safety state')
    }

    // Identical locks to the production single-worker allocator, including
    // mandatory approved photo on EVERY crew member, not just optional
    // customer identity-check bookings. Capability and market reads also
    // use the same transaction client, never the global Prisma connection.
    for (const workerUserId of sortedWorkers) {
      await lockAndAssertWorkerScheduleAvailable(
        tx, workerUserId, jobId, job.preferredDate,
        job.preferredTimeSlot, companyId, true,
      )
      const eligibility = await checkCrewCandidateEligibility(
        companyId, workerUserId, jobId, tx,
      )
      if (!eligibility.eligible) {
        throw new CrewCommitGateError('Crew member no longer satisfies service, market or schedule rules')
      }
    }

    return {
      companyId,
      jobId,
      requiredWorkersCount: job.workersCount,
      workerUserIds: sortedWorkers,
      readyForFutureReservation: true as const,
      dispatchEnabled: false as const,
    }
}

/**
 * Internal persistence primitive for FORMING only. Its caller MUST keep the
 * same SERIALIZABLE transaction open for the guard AND all slot writes.
 * There is deliberately no HTTP route, notification, worker acceptance,
 * payment, workspace or PIN integration. This is NOT live crew dispatch.
 */
export async function stageCrewReservationInsideTransaction(
  tx: Prisma.TransactionClient,
  input: CrewCommitGateInput & { leadWorkerUserId: string },
): Promise<{
  crewDispatchId: string
  version: number
  status: 'FORMING'
  reservedWorkersCount: number
  dispatchEnabled: false
}> {
  const roster = validateRoster(input.workerUserIds)
  if (!roster.includes(input.leadWorkerUserId)) {
    throw new CrewCommitGateError('Crew lead must be a selected verified worker', 400)
  }
  const gate = await assertCrewRosterReadyInsideTransaction(tx, input)
  const dispatch = await tx.companyCrewDispatch.create({
    data: {
      companyId: gate.companyId, jobId: gate.jobId,
      requiredWorkersCount: gate.requiredWorkersCount,
      leadWorkerUserId: input.leadWorkerUserId,
      status: 'FORMING', version: 1,
    },
    select: { id: true, version: true },
  })
  const reserved = await tx.companyJobAssignment.createMany({
    data: gate.workerUserIds.map((workerUserId, index) => ({
      companyId: gate.companyId, jobId: gate.jobId, workerUserId,
      assignedBy: input.actorUserId, status: 'CREW_RESERVED',
      crewDispatchId: dispatch.id, crewSlot: index + 1,
      crewRole: workerUserId === input.leadWorkerUserId ? 'LEAD' : 'MEMBER',
    })),
  })
  if (reserved.count !== gate.requiredWorkersCount) {
    throw new CrewCommitGateError('Crew reservation must be all-or-nothing')
  }
  await writeCompanyAuditLog({
    companyId: gate.companyId,
    actorId: input.actorUserId, actorRole: input.actorRole,
    action: 'CREW_ROSTER_STAGE',
    targetType: 'CompanyCrewDispatch', targetId: dispatch.id,
    description: 'Staged complete company crew roster without granting dispatch authority',
    metadata: { jobId: gate.jobId, workerCount: gate.requiredWorkersCount, crewVersion: dispatch.version },
  }, tx)
  return {
    crewDispatchId: dispatch.id, version: dispatch.version,
    status: 'FORMING', reservedWorkersCount: reserved.count,
    dispatchEnabled: false,
  }
}
