import { Prisma } from '@prisma/client'
import { prisma, type PrismaClientOrTx } from '@/lib/prisma'
import { requireJobMarket } from '@/lib/geography/market-engine'
import { checkCompanyEligibility, checkCrewCandidateEligibility } from '@/lib/phase6/provider-eligibility'
import { lockAndAssertAssignmentActorAuthorized, lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'
import { MAX_CREW_PREVIEW_WORKERS } from '@/lib/domain/company-crew-readiness'

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

/**
 * Internal commit-time gate for the FUTURE crew reservation transaction.
 *
 * Does not create a dispatch, assignment, PIN, workspace, or notification.
 * No HTTP route invokes this helper. The serializable transaction prevents
 * a caller from treating a stale preflight as proof of available capacity.
 * Work-start and single-worker guards remain unchanged.
 */
export async function checkCrewRosterAtCommit(input: CrewCommitGateInput): Promise<{
  companyId: string
  jobId: string
  requiredWorkersCount: number
  workerUserIds: string[]
  readyForFutureReservation: true
  dispatchEnabled: false
}> {
  const { companyId, jobId, actorUserId, actorRole, workerUserIds } = input
  if (!Array.isArray(workerUserIds) || workerUserIds.length < 2 ||
    workerUserIds.length > MAX_CREW_PREVIEW_WORKERS ||
    workerUserIds.some(id => typeof id !== 'string' || !id.trim() ||
      id !== id.trim() || id.length > 128) ||
    new Set(workerUserIds).size !== workerUserIds.length) {
    throw new CrewCommitGateError('Crew requires 2–12 distinct valid worker IDs', 400)
  }

  // Stable row-lock ordering prevents concurrent A→B and B→A crew requests
  // from locking the same worker identities in opposite order.
  const sortedWorkers = [...workerUserIds].sort()
  return prisma.$transaction(async tx => {
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

    const [activeAssignment, existingCrew, priorArrival, safetyMismatch] = await Promise.all([
      tx.companyJobAssignment.findFirst({
        where: { jobId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
        select: { id: true },
      }),
      tx.companyCrewDispatch.findUnique({ where: { jobId }, select: { id: true } }),
      tx.jobVerificationPin.findFirst({
        where: { jobId, arrivalVerifiedAt: { not: null } },
        select: { id: true },
      }),
      tx.jobWorkerIdentityCheck.findFirst({
        where: { jobId, status: { in: ['MISMATCH_REPORTED', 'REVIEW_REQUIRED'] } },
        select: { id: true },
      }),
    ])
    if (activeAssignment || existingCrew || priorArrival || safetyMismatch) {
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
