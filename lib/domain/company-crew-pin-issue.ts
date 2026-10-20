import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { generateCrewPinCode, deriveCrewPinDigest } from '@/lib/domain/company-crew-pin-epoch'
import { lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'
import { checkCrewCandidateEligibility, checkCompanyEligibility } from '@/lib/phase6/provider-eligibility'

/** INTERNAL ONLY: caller-owned SERIALIZABLE transaction. Not an HTTP issuer.
 * Produces one worker-specific ARRIVAL code only after revalidating all workers.
 * NEVER activates crew arrival, READY, work start, workspace or payments.
 * Caller must securely deliver returned code to the authenticated customer;
 * never log or persist plaintext. A full external protocol is NOT enabled.
 */
export async function issueStagedCrewArrivalPinInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    crewDispatchId: string; expectedVersion: number
    authenticatedCustomerUserId: string; assignmentId: string
    signingKey: Buffer
  },
): Promise<{ pin: string; challengeId: string; crewVersion: number
  arrivalEnabled: false; workStartEnabled: false }> {
  if (!input.crewDispatchId || input.crewDispatchId.length > 128 ||
      !input.assignmentId || input.assignmentId.length > 128 ||
      !input.authenticatedCustomerUserId || input.authenticatedCustomerUserId.length > 128 ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !Buffer.isBuffer(input.signingKey) || input.signingKey.length < 32) {
    throw new CrewCommitGateError('Invalid crew arrival challenge request', 400)
  }
  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: input.crewDispatchId }, select: { companyId: true, jobId: true },
  })
  if (!key) throw new CrewCommitGateError('Crew not found', 404)
  const quotes = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "JobQuote" WHERE "jobId" = ${key.jobId}
      AND "providerId" = ${key.companyId} AND "providerType" = 'COMPANY'
      AND status = 'ACCEPTED' FOR SHARE
  `
  if (quotes.length !== 1) throw new CrewCommitGateError('Crew booking is not accepted')
  const jobs = await tx.$queryRaw<Array<{
    id: string; status: string; workersCount: number; customerId: string
    preferredDate: Date | null; preferredTimeSlot: string | null
  }>>`
    SELECT id, status, "workersCount", "customerId", "preferredDate", "preferredTimeSlot"
    FROM "MarketplaceJob" WHERE id = ${key.jobId} FOR UPDATE
  `
  const job = jobs[0]
  if (!job || job.customerId !== input.authenticatedCustomerUserId) {
    throw new CrewCommitGateError('Crew booking not found', 404)
  }
  const crews = await tx.$queryRaw<Array<{
    id: string; version: number; companyId: string; jobId: string
    status: string; requiredWorkersCount: number; leadWorkerUserId: string | null
  }>>`
    SELECT id, version, "companyId", "jobId", status, "requiredWorkersCount",
      "leadWorkerUserId" FROM "CompanyCrewDispatch"
    WHERE id = ${input.crewDispatchId} FOR UPDATE
  `
  const crew = crews[0]
  if (!crew || crew.version !== input.expectedVersion || crew.status !== 'FORMING' ||
      crew.jobId !== job.id || crew.companyId !== key.companyId ||
      job.status !== 'QUOTE_ACCEPTED' || job.workersCount !== crew.requiredWorkersCount ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) {
    throw new CrewCommitGateError('Crew version or booking changed')
  }
  const company = await checkCompanyEligibility(crew.companyId, tx)
  if (!company.eligible) throw new CrewCommitGateError('Company no longer eligible')
  const [priorArrival, legacyPin, mismatch] = await Promise.all([
    tx.jobVerificationPin.findFirst({
      where: { jobId: job.id, arrivalVerifiedAt: { not: null } }, select: { id: true },
    }),
    tx.jobVerificationPin.findFirst({
      where: { jobId: job.id, status: 'ACTIVE' }, select: { id: true },
    }),
    tx.jobWorkerIdentityCheck.findFirst({
      where: { jobId: job.id, status: { in: ['MISMATCH_REPORTED', 'REVIEW_REQUIRED'] } },
      select: { id: true },
    }),
  ])
  if (priorArrival || legacyPin || mismatch) {
    throw new CrewCommitGateError('Crew safety or previous arrival blocks challenge')
  }
  const slots = await tx.companyJobAssignment.findMany({
    where: { crewDispatchId: crew.id },
    select: {
      id: true, jobId: true, companyId: true, workerUserId: true,
      status: true, crewSlot: true, crewRole: true,
      acceptedAt: true, crewIdentityConfirmedAt: true,
      crewArrivedAt: true, startedAt: true,
    },
  })
  const selected = slots.find(s => s.id === input.assignmentId)
  if (!selected || slots.length !== crew.requiredWorkersCount ||
      new Set(slots.map(s => s.workerUserId)).size !== slots.length ||
      new Set(slots.map(s => s.crewSlot)).size !== slots.length ||
      slots.filter(s => s.crewRole === 'LEAD').length !== 1 ||
      slots.find(s => s.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId ||
      slots.some(s => s.jobId !== job.id || s.companyId !== crew.companyId ||
        !s.crewSlot || s.status !== 'CREW_ACCEPTED' ||
        !s.acceptedAt || !s.crewIdentityConfirmedAt ||
        s.crewIdentityConfirmedAt < s.acceptedAt ||
        s.crewArrivedAt !== null || s.startedAt !== null)) {
    throw new CrewCommitGateError('Entire crew must be accepted and photo confirmed')
  }
  for (const slot of [...slots].sort((a,b) => a.workerUserId.localeCompare(b.workerUserId))) {
    await lockAndAssertWorkerScheduleAvailable(
      tx, slot.workerUserId, job.id, job.preferredDate,
      job.preferredTimeSlot, crew.companyId, true,
    )
    const candidate = await checkCrewCandidateEligibility(
      crew.companyId, slot.workerUserId, job.id, tx,
    )
    if (!candidate.eligible) throw new CrewCommitGateError('Crew member lost eligibility')
    const photo = await tx.providerIdentity.findFirst({
      where: {
        currentUserId: slot.workerUserId,
        identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
        kycStatus: 'VERIFIED', verifiedPhotoUrl: { not: null },
      },
      orderBy: { updatedAt: 'desc' }, select: { id: true, verifiedPhotoUrl: true },
    })
    if (!photo?.verifiedPhotoUrl) throw new CrewCommitGateError('Crew member photo withdrawn')
    const confirmed = await tx.jobWorkerIdentityCheck.findUnique({
      where: { jobId_providerIdentityId: { jobId: job.id, providerIdentityId: photo.id } },
      select: {
        status: true, assignedWorkerUserId: true, photoSnapshotUrl: true,
        confirmedAt: true,
      },
    })
    if (!confirmed || confirmed.status !== 'MATCHED' ||
        confirmed.assignedWorkerUserId !== slot.workerUserId ||
        confirmed.photoSnapshotUrl !== photo.verifiedPhotoUrl ||
        !confirmed.confirmedAt || confirmed.confirmedAt < slot.acceptedAt! ||
        confirmed.confirmedAt > slot.crewIdentityConfirmedAt!) {
      throw new CrewCommitGateError('Crew photo confirmation stale')
    }
  }

  // Fail closed instead of silently replacing a previously issued/consumed
  // challenge; unique live index is an additional database race backstop.
  const existing = await tx.companyCrewPinChallenge.findFirst({
    where: {
      crewDispatchId: crew.id, crewVersion: crew.version,
      assignmentId: selected.id, purpose: 'ARRIVAL',
    },
    select: { id: true },
  })
  if (existing) throw new CrewCommitGateError('Crew challenge already issued for this epoch')

  const pin = generateCrewPinCode()
  const digest = deriveCrewPinDigest(pin, {
    crewDispatchId: crew.id, jobId: job.id, crewVersion: crew.version,
    assignmentId: selected.id, workerUserId: selected.workerUserId, purpose: 'ARRIVAL',
  }, input.signingKey)
  const record = await tx.companyCrewPinChallenge.create({
    data: {
      crewDispatchId: crew.id, assignmentId: selected.id, jobId: job.id,
      crewVersion: crew.version, purpose: 'ARRIVAL', challengeVersion: 1,
      pinDigest: digest, issuedByCustomerUserId: job.customerId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
    select: { id: true },
  })
  return {
    pin, challengeId: record.id, crewVersion: crew.version,
    arrivalEnabled: false, workStartEnabled: false,
  }
}
