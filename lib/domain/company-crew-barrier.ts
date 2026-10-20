import { Prisma } from '@prisma/client'
import { requireJobMarket } from '@/lib/geography/market-engine'
import { checkCompanyEligibility, checkCrewCandidateEligibility } from '@/lib/phase6/provider-eligibility'
import {
  lockAndAssertAssignmentActorAuthorized,
  lockAndAssertWorkerScheduleAvailable,
} from '@/lib/domain/company-job-assignment'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'

/**
 * Internal, read-only all-member evidence barrier for Phase 04. It performs
 * every check inside the *same* caller-owned SERIALIZABLE transaction with
 * stable locks. Never call it as a standalone preflight followed by a write.
 *
 * This does NOT authorize arrival, PIN, workspace, payment or work-start.
 * Those independent multi-person transitions remain explicitly disabled.
 */
export async function assertStagedCrewIdentityEvidenceInsideTransaction(
  tx: Prisma.TransactionClient,
  input:
    | {
        crewDispatchId: string
        expectedVersion: number
        actorUserId: string // authenticated company dispatcher
        actorRole: string // active company role
        customerUserId?: never
      }
    | {
        crewDispatchId: string
        expectedVersion: number
        customerUserId: string // authenticated booking customer ONLY
        actorUserId?: never
        actorRole?: never
      },
): Promise<{
  crewDispatchId: string
  version: number
  requiredWorkersCount: number
  memberEvidenceComplete: true
  dispatchEnabled: false
  arrivalEnabled: false
  workStartEnabled: false
}> {
  if (!input.crewDispatchId || input.crewDispatchId.length > 128 ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      ('customerUserId' in input
        ? (!input.customerUserId || input.customerUserId.length > 128)
        : (!input.actorUserId || input.actorUserId.length > 128 ||
          !input.actorRole || input.actorRole.length > 128))) {
    throw new CrewCommitGateError('Invalid crew evidence request', 400)
  }

  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: input.crewDispatchId },
    select: { companyId: true, jobId: true },
  })
  if (!key) throw new CrewCommitGateError('Crew booking not found', 404)
  if (input.customerUserId) {
    // A customer can only review evidence for their OWN booking. The customer
    // never gains dispatcher permissions, and neither caller can select a
    // different user through request body parameters.
    const ownership = await tx.marketplaceJob.findUnique({
      where: { id: key.jobId },
      select: { customerId: true },
    })
    if (!ownership || ownership.customerId !== input.customerUserId) {
      throw new CrewCommitGateError('Crew booking not found', 404)
    }
  } else {
    // Managers recheck current global account and membership under the same
    // locks used by workforce role changes. Customer authorization is never
    // inferred from the manager's role (or the historical founder ID).
    await lockAndAssertAssignmentActorAuthorized(
      tx, key.companyId, input.actorUserId!, input.actorRole!,
    )
  }

  const quotes = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "JobQuote"
    WHERE "jobId" = ${key.jobId} AND "providerId" = ${key.companyId}
      AND "providerType" = 'COMPANY' AND status = 'ACCEPTED'
    FOR SHARE
  `
  if (quotes.length !== 1) throw new CrewCommitGateError('Accepted crew quote changed')
  const jobs = await tx.$queryRaw<Array<{
    id: string; status: string; workersCount: number
    countryCode: string; latitude: number | null; longitude: number | null
    preferredDate: Date | null; preferredTimeSlot: string | null
    targetTaskerId: string | null
  }>>`
    SELECT id, status, "workersCount", "countryCode", latitude, longitude,
      "preferredDate", "preferredTimeSlot", "targetTaskerId"
    FROM "MarketplaceJob" WHERE id = ${key.jobId} FOR UPDATE
  `
  const job = jobs[0]
  const crews = await tx.$queryRaw<Array<{
    id: string; companyId: string; jobId: string
    status: string; version: number; requiredWorkersCount: number
    leadWorkerUserId: string | null
  }>>`
    SELECT id, "companyId", "jobId", status, version, "requiredWorkersCount",
      "leadWorkerUserId"
    FROM "CompanyCrewDispatch" WHERE id = ${input.crewDispatchId} FOR UPDATE
  `
  const crew = crews[0]
  if (!crew || !job || crew.version !== input.expectedVersion ||
      crew.status !== 'FORMING' || job.status !== 'QUOTE_ACCEPTED' ||
      crew.companyId !== key.companyId || crew.jobId !== key.jobId ||
      crew.requiredWorkersCount !== job.workersCount ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) {
    throw new CrewCommitGateError('Crew roster epoch or booking changed')
  }
  const market = requireJobMarket(job)
  const company = await tx.companyProfile.findUnique({
    where: { id: crew.companyId },
    select: { countryCode: true, userId: true },
  })
  if (!market.ok || !company ||
      company.countryCode.trim().toUpperCase() !== market.countryCode ||
      (job.targetTaskerId &&
        ![crew.companyId, company.userId].includes(job.targetTaskerId))) {
    throw new CrewCommitGateError('Crew market or target is no longer valid')
  }

  const companyEligibility = await checkCompanyEligibility(crew.companyId, tx)
  if (!companyEligibility.eligible) throw new CrewCommitGateError('Company eligibility changed')

  const [arrival, activePin, safetyMismatch] = await Promise.all([
    tx.jobVerificationPin.findFirst({
      where: { jobId: crew.jobId, arrivalVerifiedAt: { not: null } },
      select: { id: true },
    }),
    tx.jobVerificationPin.findFirst({
      where: { jobId: crew.jobId, status: 'ACTIVE' },
      select: { id: true },
    }),
    tx.jobWorkerIdentityCheck.findFirst({
      where: {
        jobId: crew.jobId,
        status: { in: ['MISMATCH_REPORTED', 'REVIEW_REQUIRED'] },
      },
      select: { id: true },
    }),
  ])
  if (arrival || activePin || safetyMismatch) {
    throw new CrewCommitGateError('Arrival PIN or identity safety review blocks the crew')
  }

  const slots = await tx.companyJobAssignment.findMany({
    where: { crewDispatchId: crew.id },
    select: {
      id: true, companyId: true, jobId: true,
      workerUserId: true, status: true, crewSlot: true, crewRole: true,
      acceptedAt: true, crewIdentityConfirmedAt: true,
      crewArrivedAt: true, startedAt: true,
    },
  })
  if (slots.length !== crew.requiredWorkersCount ||
      new Set(slots.map(slot => slot.workerUserId)).size !== slots.length ||
      new Set(slots.map(slot => slot.crewSlot)).size !== slots.length ||
      slots.filter(slot => slot.crewRole === 'LEAD').length !== 1 ||
      slots.find(slot => slot.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId ||
      slots.some(slot =>
        slot.companyId !== crew.companyId || slot.jobId !== crew.jobId ||
        !slot.crewSlot || slot.status !== 'CREW_ACCEPTED' ||
        !slot.acceptedAt || !slot.crewIdentityConfirmedAt ||
        slot.crewIdentityConfirmedAt < slot.acceptedAt ||
        slot.crewArrivedAt !== null || slot.startedAt !== null)) {
    throw new CrewCommitGateError('All crew members must accept and have current photo confirmation')
  }

  // Order User and TeamMember locks by worker ID to align with the reservation
  // writer and reduce deadlock risk with concurrent dispatcher actions.
  for (const slot of [...slots].sort((a, b) => a.workerUserId.localeCompare(b.workerUserId))) {
    await lockAndAssertWorkerScheduleAvailable(
      tx, slot.workerUserId, crew.jobId, job.preferredDate,
      job.preferredTimeSlot, crew.companyId, true,
    )
    const eligibility = await checkCrewCandidateEligibility(
      crew.companyId, slot.workerUserId, crew.jobId, tx,
    )
    if (!eligibility.eligible) {
      throw new CrewCommitGateError('A crew member lost service or market eligibility')
    }

    // Photo identities are individually verified and can change after
    // the customer confirms. Re-evaluate the SAME latest verified photo
    // selection as the customer preview and decision endpoint.
    const photo = await tx.providerIdentity.findFirst({
      where: {
        currentUserId: slot.workerUserId,
        identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
        kycStatus: 'VERIFIED',
        verifiedPhotoUrl: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, verifiedPhotoUrl: true },
    })
    if (!photo?.verifiedPhotoUrl) {
      throw new CrewCommitGateError('Crew member verified photo has been withdrawn')
    }
    const confirmation = await tx.jobWorkerIdentityCheck.findUnique({
      where: {
        jobId_providerIdentityId: {
          jobId: crew.jobId,
          providerIdentityId: photo.id,
        },
      },
      select: {
        assignedWorkerUserId: true, photoSnapshotUrl: true,
        status: true, confirmedAt: true,
      },
    })
    if (!confirmation || confirmation.status !== 'MATCHED' ||
        confirmation.assignedWorkerUserId !== slot.workerUserId ||
        confirmation.photoSnapshotUrl !== photo.verifiedPhotoUrl ||
        !confirmation.confirmedAt ||
        confirmation.confirmedAt < slot.acceptedAt! ||
        slot.crewIdentityConfirmedAt! < confirmation.confirmedAt) {
      throw new CrewCommitGateError('Crew member photo confirmation is missing or stale')
    }
  }

  return {
    crewDispatchId: crew.id, version: crew.version,
    requiredWorkersCount: crew.requiredWorkersCount,
    memberEvidenceComplete: true,
    dispatchEnabled: false, arrivalEnabled: false, workStartEnabled: false,
  }
}
