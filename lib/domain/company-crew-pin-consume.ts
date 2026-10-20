import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'
import { checkCrewCandidateEligibility } from '@/lib/phase6/provider-eligibility'
import { matchesCrewPinDigest, type CrewPinScope } from '@/lib/domain/company-crew-pin-epoch'

type Purpose = 'ARRIVAL' | 'WORK_START'

/**
 * Internal, transaction-only Phase04 per-worker PIN consumption proof.
 * NOT reachable from HTTP/mobile. Caller must bind workerUserId to an
 * authenticated session and use a SERIALIZABLE transaction.
 * Never sets crewArrivedAt, crew READY, job/workspace, payment, or work start:
 * physical presence and entire-crew start require separately certified gates.
 *
 * A failed PIN attempt returns (rather than throwing) AFTER an atomic failed
 * attempt count write so a caller does not roll back its security throttle.
 */
export async function consumeStagedCrewMemberPinInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    crewDispatchId: string
    expectedVersion: number
    authenticatedWorkerUserId: string
    purpose: Purpose
    pin: string
    signingKey: Buffer
  },
): Promise<{
  pinVerified: boolean
  attemptsRemaining: number
  arrivalEnabled: false
  workStartEnabled: false
}> {
  // Defense in depth: even an accidentally introduced direct server caller
  // may not consume crew challenges in a production process.
  if (process.env.NODE_ENV === 'production') {
    throw new CrewCommitGateError('Crew arrival PIN consumption is not enabled')
  }
  if (typeof input.crewDispatchId !== 'string' ||
      !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
      typeof input.authenticatedWorkerUserId !== 'string' ||
      !input.authenticatedWorkerUserId.trim() ||
      input.authenticatedWorkerUserId.length > 128 ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !['ARRIVAL', 'WORK_START'].includes(input.purpose) ||
      typeof input.pin !== 'string' || !/^[0-9]{6}$/.test(input.pin) ||
      !Buffer.isBuffer(input.signingKey) || input.signingKey.length < 32) {
    throw new CrewCommitGateError('Invalid crew PIN verification request', 400)
  }
  // No work-start verification until entire group arrival, customer photo,
  // payment, job/workspace and safety guards exist end-to-end.
  if (input.purpose === 'WORK_START') {
    throw new CrewCommitGateError('Crew work-start PIN remains disabled')
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
  if (quotes.length !== 1) throw new CrewCommitGateError('Crew booking no longer accepted')
  const jobs = await tx.$queryRaw<Array<{
    id: string; status: string; workersCount: number; customerId: string
    preferredDate: Date | null; preferredTimeSlot: string | null
  }>>`
    SELECT id, status, "workersCount", "customerId",
      "preferredDate", "preferredTimeSlot"
    FROM "MarketplaceJob" WHERE id = ${key.jobId} FOR UPDATE
  `
  const crews = await tx.$queryRaw<Array<{
    id: string; companyId: string; jobId: string
    status: string; version: number; requiredWorkersCount: number
    leadWorkerUserId: string | null
  }>>`
    SELECT id, "companyId", "jobId", status, version,
      "requiredWorkersCount", "leadWorkerUserId"
    FROM "CompanyCrewDispatch" WHERE id = ${input.crewDispatchId} FOR UPDATE
  `
  const crew = crews[0], job = jobs[0]
  if (!crew || !job || crew.companyId !== key.companyId ||
      crew.jobId !== key.jobId || crew.status !== 'FORMING' ||
      crew.version !== input.expectedVersion ||
      job.status !== 'QUOTE_ACCEPTED' ||
      job.workersCount !== crew.requiredWorkersCount ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) {
    throw new CrewCommitGateError('Crew or booking epoch has changed')
  }
  const slots = await tx.companyJobAssignment.findMany({
    where: { crewDispatchId: crew.id },
    select: {
      id: true, jobId: true, companyId: true, workerUserId: true,
      status: true, crewArrivedAt: true, startedAt: true,
      acceptedAt: true, crewIdentityConfirmedAt: true,
      crewSlot: true, crewRole: true,
    },
  })
  const own = slots.find(slot => slot.workerUserId === input.authenticatedWorkerUserId)
  if (!own) throw new CrewCommitGateError('Crew invitation not found', 404)
  if (slots.some(s => s.workerUserId === job.customerId)) {
    throw new CrewCommitGateError('Booking customer cannot verify a crew PIN as a worker')
  }
  if (slots.length !== crew.requiredWorkersCount ||
      new Set(slots.map(s => s.workerUserId)).size !== slots.length ||
      new Set(slots.map(s => s.crewSlot)).size !== slots.length ||
      slots.filter(s => s.crewRole === 'LEAD').length !== 1 ||
      slots.find(s => s.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId ||
      slots.some(s => s.jobId !== job.id || s.companyId !== key.companyId ||
        s.status !== 'CREW_ACCEPTED' || !s.acceptedAt ||
        !s.crewIdentityConfirmedAt || s.crewIdentityConfirmedAt < s.acceptedAt ||
        s.crewArrivedAt !== null || s.startedAt !== null)) {
    throw new CrewCommitGateError('All crew members require current identity approval')
  }
  const mismatch = await tx.jobWorkerIdentityCheck.findFirst({
    where: {
      jobId: job.id,
      status: { in: ['MISMATCH_REPORTED', 'REVIEW_REQUIRED'] },
    },
    select: { id: true },
  })
  const priorArrival = await tx.jobVerificationPin.findFirst({
    where: { jobId: job.id, arrivalVerifiedAt: { not: null } },
    select: { id: true },
  })
  const activeLegacyPin = await tx.jobVerificationPin.findFirst({
    where: { jobId: job.id, status: 'ACTIVE' }, select: { id: true },
  })
  if (mismatch || priorArrival || activeLegacyPin) {
    throw new CrewCommitGateError('Crew has unresolved safety or old arrival evidence')
  }

  // Authorize every CURRENT worker in stable ID order: each account,
  // membership, verified photo and customer snapshot can change after the
  // customer pressed Match. A verified PIN does not bypass group safety.
  for (const slot of [...slots].sort((a, b) =>
    a.workerUserId.localeCompare(b.workerUserId))) {
    await lockAndAssertWorkerScheduleAvailable(
      tx, slot.workerUserId, job.id,
      job.preferredDate, job.preferredTimeSlot, key.companyId, true,
    )
    const eligibility = await checkCrewCandidateEligibility(
      key.companyId, slot.workerUserId, job.id, tx,
    )
    if (!eligibility.eligible) throw new CrewCommitGateError('Crew worker eligibility changed')
    const photo = await tx.providerIdentity.findFirst({
      where: {
        currentUserId: slot.workerUserId,
        identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
        kycStatus: 'VERIFIED', verifiedPhotoUrl: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, verifiedPhotoUrl: true },
    })
    if (!photo?.verifiedPhotoUrl) throw new CrewCommitGateError('Crew worker photo is no longer verified')
    const confirmed = await tx.jobWorkerIdentityCheck.findUnique({
      where: { jobId_providerIdentityId: {
        jobId: job.id, providerIdentityId: photo.id,
      } },
      select: {
        status: true, assignedWorkerUserId: true, confirmedAt: true,
        photoSnapshotUrl: true,
      },
    })
    if (!confirmed || confirmed.status !== 'MATCHED' ||
        confirmed.assignedWorkerUserId !== slot.workerUserId ||
        confirmed.photoSnapshotUrl !== photo.verifiedPhotoUrl ||
        !confirmed.confirmedAt ||
        confirmed.confirmedAt < slot.acceptedAt! ||
        confirmed.confirmedAt > slot.crewIdentityConfirmedAt!) {
      throw new CrewCommitGateError('Crew worker photo confirmation changed')
    }
  }

  // Guard against cross-job/worker challenge reuse and consume exactly once.
  const challenges = await tx.$queryRaw<Array<{
    id: string; crewDispatchId: string; crewVersion: number
    assignmentId: string; jobId: string; issuedByCustomerUserId: string
    purpose: string; pinDigest: string; expiresAt: Date
    failedAttempts: number; lockedUntil: Date | null
    consumedAt: Date | null; revokedAt: Date | null
  }>>`
    SELECT * FROM "CompanyCrewPinChallenge"
    WHERE "crewDispatchId" = ${crew.id}
      AND "crewVersion" = ${crew.version}
      AND "assignmentId" = ${own.id} AND purpose = 'ARRIVAL'
      AND "consumedAt" IS NULL AND "revokedAt" IS NULL
    ORDER BY "challengeVersion" DESC LIMIT 1 FOR UPDATE
  `
  const challenge = challenges[0], now = new Date()
  if (!challenge || challenge.jobId !== job.id ||
      challenge.issuedByCustomerUserId !== job.customerId ||
      challenge.crewDispatchId !== crew.id ||
      challenge.crewVersion !== crew.version || challenge.assignmentId !== own.id ||
      challenge.purpose !== 'ARRIVAL' ||
      challenge.expiresAt <= now || challenge.failedAttempts >= 5 ||
      (challenge.lockedUntil && challenge.lockedUntil > now)) {
    throw new CrewCommitGateError('Crew PIN unavailable or locked')
  }
  const scope: CrewPinScope = {
    crewDispatchId: crew.id, jobId: job.id,
    crewVersion: crew.version, assignmentId: own.id,
    workerUserId: own.workerUserId, purpose: 'ARRIVAL',
  }
  const valid = matchesCrewPinDigest(
    input.pin, challenge.pinDigest, scope, input.signingKey,
  )
  if (!valid) {
    const next = challenge.failedAttempts + 1
    const wrote = await tx.companyCrewPinChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, revokedAt: null,
        failedAttempts: challenge.failedAttempts },
      data: { failedAttempts: next,
        lockedUntil: next >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null },
    })
    if (wrote.count !== 1) throw new CrewCommitGateError('Crew PIN attempt raced')
    return {
      pinVerified: false, attemptsRemaining: Math.max(0, 5 - next),
      arrivalEnabled: false, workStartEnabled: false,
    }
  }
  const wrote = await tx.companyCrewPinChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null, revokedAt: null,
      failedAttempts: challenge.failedAttempts },
    data: { consumedAt: now },
  })
  if (wrote.count !== 1) throw new CrewCommitGateError('Crew PIN already consumed')
  return { pinVerified: true, attemptsRemaining: 0,
    arrivalEnabled: false, workStartEnabled: false }
}
