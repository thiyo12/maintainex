import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { checkCompanyEligibility, checkCrewCandidateEligibility } from '@/lib/phase6/provider-eligibility'
import { lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'
import { requireJobMarket } from '@/lib/geography/market-engine'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

/**
 * INTERNAL-ONLY, development/test evidence writer, not an HTTP endpoint.
 * The caller must bind authenticatedUserId to an independently authenticated
 * CUSTOMER or WORKER session and use a SERIALIZABLE transaction.
 * No "on behalf of" writes. Each actor may attest their own side ONCE.
 *
 * A PIN claim and two attestations are NOT proof of physical presence:
 * no location corroboration, READY, arrival, job/workspace, work-start, or
 * payment authorization follows from this function.
 */
export async function recordCrewPresenceWitnessInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    crewDispatchId: string
    expectedVersion: number
    assignmentId: string
    authenticatedUserId: string
    participant: 'CUSTOMER' | 'WORKER'
  },
): Promise<{
  crewDispatchId: string
  crewVersion: number
  assignmentId: string
  participantRecorded: 'CUSTOMER' | 'WORKER'
  physicalPresenceVerified: false
  arrivalEnabled: false
  workStartEnabled: false
}> {
  if (process.env.NODE_ENV === 'production') {
    throw new CrewCommitGateError('Crew presence recording is not enabled')
  }
  if (!input || typeof input.crewDispatchId !== 'string' ||
      !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
      typeof input.assignmentId !== 'string' ||
      !input.assignmentId.trim() || input.assignmentId.length > 128 ||
      typeof input.authenticatedUserId !== 'string' ||
      !input.authenticatedUserId.trim() || input.authenticatedUserId.length > 128 ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !['CUSTOMER', 'WORKER'].includes(input.participant)) {
    throw new CrewCommitGateError('Invalid crew witness scope', 400)
  }
  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: input.crewDispatchId },
    select: { companyId: true, jobId: true },
  })
  if (!key) throw new CrewCommitGateError('Crew booking not found', 404)
  const quotes = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "JobQuote" WHERE "jobId" = ${key.jobId}
      AND "providerId" = ${key.companyId} AND "providerType" = 'COMPANY'
      AND status = 'ACCEPTED' FOR SHARE
  `
  if (quotes.length !== 1) throw new CrewCommitGateError('Crew quote is no longer accepted')
  // Lock job before crew, matching lifecycle cancellation, PIN consumption
  // and workforce transitions. New attestations cannot race a terminal epoch.
  const jobs = await tx.$queryRaw<Array<{
    id: string; customerId: string; status: string; workersCount: number
    countryCode: string; latitude: number | null; longitude: number | null
    targetTaskerId: string | null; preferredDate: Date | null
    preferredTimeSlot: string | null
  }>>`
    SELECT id, "customerId", status, "workersCount", "countryCode",
      latitude, longitude, "targetTaskerId", "preferredDate", "preferredTimeSlot"
    FROM "MarketplaceJob" WHERE id = ${key.jobId} FOR UPDATE
  `
  const crews = await tx.$queryRaw<Array<{
    id: string; companyId: string; jobId: string; status: string
    version: number; requiredWorkersCount: number; leadWorkerUserId: string | null
  }>>`
    SELECT id, "companyId", "jobId", status, version,
      "requiredWorkersCount", "leadWorkerUserId"
    FROM "CompanyCrewDispatch" WHERE id = ${input.crewDispatchId} FOR UPDATE
  `
  const job = jobs[0], crew = crews[0]
  if (!job || !crew || crew.companyId !== key.companyId ||
      crew.jobId !== job.id || crew.status !== 'FORMING' ||
      crew.version !== input.expectedVersion ||
      job.status !== 'QUOTE_ACCEPTED' ||
      job.workersCount !== crew.requiredWorkersCount ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) {
    throw new CrewCommitGateError('Crew booking or epoch changed')
  }
  const accounts = await tx.$queryRaw<Array<{
    id: string; isActive: boolean; isSuspended: boolean; isBanned: boolean
  }>>`
    SELECT id, "isActive", "isSuspended", "isBanned" FROM "User"
    WHERE id = ${input.authenticatedUserId} FOR UPDATE
  `
  if (accounts.length !== 1 || accounts[0].id !== input.authenticatedUserId ||
      !accounts[0].isActive || accounts[0].isSuspended || accounts[0].isBanned) {
    throw new CrewCommitGateError('Crew witness actor is restricted', 403)
  }
  if (input.participant === 'CUSTOMER' &&
      job.customerId !== input.authenticatedUserId) {
    throw new CrewCommitGateError('Crew booking not found', 404)
  }

  const market = requireJobMarket(job)
  const company = await tx.companyProfile.findUnique({
    where: { id: crew.companyId }, select: { countryCode: true, userId: true },
  })
  const eligibleCompany = await checkCompanyEligibility(crew.companyId, tx)
  if (!market.ok || !company ||
      company.countryCode.trim().toUpperCase() !== market.countryCode ||
      (job.targetTaskerId &&
        ![company.userId, crew.companyId].includes(job.targetTaskerId)) ||
      !eligibleCompany.eligible) {
    throw new CrewCommitGateError('Crew company or market changed')
  }

  const [legacyArrival, legacyActive, safety, slots, challenges] = await Promise.all([
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
    tx.companyJobAssignment.findMany({
      where: { crewDispatchId: crew.id },
      select: {
        id: true, jobId: true, companyId: true, workerUserId: true,
        status: true, crewSlot: true, crewRole: true,
        acceptedAt: true, crewIdentityConfirmedAt: true,
        crewArrivedAt: true, startedAt: true,
      },
    }),
    tx.companyCrewPinChallenge.findMany({
      where: { crewDispatchId: crew.id, crewVersion: crew.version, purpose: 'ARRIVAL' },
      select: {
        id: true, assignmentId: true, jobId: true,
        crewVersion: true, issuedByCustomerUserId: true,
        purpose: true, consumedAt: true, createdAt: true,
        expiresAt: true, revokedAt: true, failedAttempts: true,
        lockedUntil: true,
      },
    }),
  ])
  if (legacyArrival || legacyActive || safety ||
      slots.length !== crew.requiredWorkersCount ||
      challenges.length !== slots.length ||
      new Set(slots.map(s => s.id)).size !== slots.length ||
      new Set(slots.map(s => s.workerUserId)).size !== slots.length ||
      new Set(slots.map(s => s.crewSlot)).size !== slots.length ||
      new Set(challenges.map(c => c.assignmentId)).size !== challenges.length ||
      slots.filter(s => s.crewRole === 'LEAD').length !== 1 ||
      slots.find(s => s.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId ||
      slots.some(s => s.jobId !== job.id || s.companyId !== crew.companyId ||
        !s.crewSlot || s.status !== 'CREW_ACCEPTED' ||
        !s.acceptedAt || !s.crewIdentityConfirmedAt ||
        s.crewIdentityConfirmedAt < s.acceptedAt ||
        s.crewArrivedAt !== null || s.startedAt !== null)) {
    throw new CrewCommitGateError('Complete accepted crew and safety evidence required')
  }
  // Independent attestations require independent PEOPLE/accounts. Even if
  // the HTTP layer rejects a dual-role actor, future internal callers must
  // not let the booking customer attest as any member of this same crew.
  if (slots.some(slot => slot.workerUserId === job.customerId)) {
    throw new CrewCommitGateError('Customer cannot witness their own crew assignment')
  }
  const selected = slots.find(s => s.id === input.assignmentId)
  if (!selected || (input.participant === 'WORKER' &&
      selected.workerUserId !== input.authenticatedUserId)) {
    throw new CrewCommitGateError('Crew witness assignment not found', 404)
  }
  const now = new Date()
  for (const slot of [...slots].sort((a,b) => a.workerUserId.localeCompare(b.workerUserId))) {
    await lockAndAssertWorkerScheduleAvailable(
      tx, slot.workerUserId, job.id, job.preferredDate, job.preferredTimeSlot,
      crew.companyId, true,
    )
    const eligible = await checkCrewCandidateEligibility(
      crew.companyId, slot.workerUserId, job.id, tx,
    )
    if (!eligible.eligible) throw new CrewCommitGateError('Crew worker eligibility changed')
    const photo = await tx.providerIdentity.findFirst({
      where: {
        currentUserId: slot.workerUserId,
        identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
        kycStatus: 'VERIFIED', verifiedPhotoUrl: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, verifiedPhotoUrl: true },
    })
    if (!photo?.verifiedPhotoUrl) throw new CrewCommitGateError('Crew verified photo withdrawn')
    const matched = await tx.jobWorkerIdentityCheck.findUnique({
      where: { jobId_providerIdentityId: {
        jobId: job.id, providerIdentityId: photo.id,
      } },
      select: {
        status: true, assignedWorkerUserId: true,
        photoSnapshotUrl: true, confirmedAt: true,
      },
    })
    if (!matched || matched.status !== 'MATCHED' ||
        matched.assignedWorkerUserId !== slot.workerUserId ||
        matched.photoSnapshotUrl !== photo.verifiedPhotoUrl ||
        !matched.confirmedAt || matched.confirmedAt < slot.acceptedAt! ||
        matched.confirmedAt > slot.crewIdentityConfirmedAt!) {
      throw new CrewCommitGateError('Crew customer photo approval changed')
    }
  }
  // A worker cannot attest before EVERY member has independently consumed
  // the code issued by this exact booking customer in this exact crew epoch.
  for (const slot of slots) {
    const claim = challenges.find(c => c.assignmentId === slot.id)
    if (!claim || claim.jobId !== job.id ||
        claim.crewVersion !== crew.version ||
        claim.issuedByCustomerUserId !== job.customerId ||
        claim.purpose !== 'ARRIVAL' ||
        claim.revokedAt !== null || !claim.consumedAt ||
        claim.failedAttempts >= 5 ||
        (claim.lockedUntil && claim.lockedUntil >= claim.consumedAt) ||
        claim.createdAt.getTime() >= claim.expiresAt.getTime() ||
        claim.consumedAt < claim.createdAt ||
        claim.consumedAt > claim.expiresAt ||
        claim.consumedAt > now ||
        now.getTime() - claim.consumedAt.getTime() > 10 * 60 * 1000) {
      throw new CrewCommitGateError('Crew member PIN evidence is stale or incomplete')
    }
  }
  const existing = await tx.companyCrewPresenceWitness.findFirst({
    where: {
      crewDispatchId: crew.id, crewVersion: crew.version,
      assignmentId: selected.id,
    },
  })
  const isWorker = input.participant === 'WORKER'
  const field = isWorker ? 'workerAttestedAt' : 'customerAttestedAt'
  if (existing &&
      (existing.jobId !== job.id || existing.customerUserId !== job.customerId ||
        existing.workerUserId !== selected.workerUserId || existing[field] !== null)) {
    throw new CrewCommitGateError('Crew witness is stale or already recorded')
  }
  if (existing) {
    const written = await tx.companyCrewPresenceWitness.updateMany({
      where: {
        id: existing.id, crewDispatchId: crew.id,
        crewVersion: crew.version, assignmentId: selected.id,
        customerUserId: job.customerId, workerUserId: selected.workerUserId,
        [field]: null,
      },
      data: isWorker ? { workerAttestedAt: now } : { customerAttestedAt: now },
    })
    if (written.count !== 1) throw new CrewCommitGateError('Crew witness changed concurrently')
  } else {
    await tx.companyCrewPresenceWitness.create({
      data: {
        crewDispatchId: crew.id, crewVersion: crew.version,
        assignmentId: selected.id, jobId: job.id,
        customerUserId: job.customerId, workerUserId: selected.workerUserId,
        ...(isWorker ? { workerAttestedAt: now } : { customerAttestedAt: now }),
      },
    })
  }
  await writeCompanyAuditLog({
    companyId: crew.companyId, actorId: input.authenticatedUserId,
    actorRole: input.participant, action: 'CREW_PRESENCE_ACKNOWLEDGED',
    targetType: 'CompanyCrewDispatch', targetId: crew.id,
    description: 'Internal non-authorizing individual crew witness acknowledgement',
    metadata: {
      jobId: job.id, crewVersion: crew.version, assignmentId: selected.id,
      participant: input.participant, physicalPresenceVerified: false,
    },
  }, tx)
  return {
    crewDispatchId: crew.id, crewVersion: crew.version,
    assignmentId: selected.id, participantRecorded: input.participant,
    physicalPresenceVerified: false, arrivalEnabled: false, workStartEnabled: false,
  }
}
