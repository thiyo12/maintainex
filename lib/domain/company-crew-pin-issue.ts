import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'
import { checkCompanyEligibility, checkCrewCandidateEligibility } from '@/lib/phase6/provider-eligibility'
import { requireJobMarket } from '@/lib/geography/market-engine'
import { generateCrewPinCode, deriveCrewPinDigest } from '@/lib/domain/company-crew-pin-epoch'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

/**
 * INTERNAL transaction-only customer-bound issuance. There is NO public
 * route; never allow this writer in production until group presence,
 * cancellation, payments, ops and work-start have all been approved.
 * Caller must bind customerUserId to its authenticated account and supply
 * a server-held PIN signing key in the same SERIALIZABLE transaction.
 * Codes are returned only to the caller (future authenticated customer).
 */
export async function issueStagedCrewArrivalPinsInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    crewDispatchId: string
    expectedVersion: number
    authenticatedCustomerUserId: string
    signingKey: Buffer
  },
): Promise<{
  crewDispatchId: string
  crewVersion: number
  memberCodes: Array<{ assignmentId: string; pin: string }>
  arrivalEnabled: false
  workStartEnabled: false
}> {
  if (process.env.NODE_ENV === 'production') {
    throw new CrewCommitGateError('Crew arrival PIN issuance is not enabled')
  }
  if (!input || typeof input.crewDispatchId !== 'string' ||
      !input.crewDispatchId.trim() || input.crewDispatchId.length > 128 ||
      typeof input.authenticatedCustomerUserId !== 'string' ||
      !input.authenticatedCustomerUserId.trim() ||
      input.authenticatedCustomerUserId.length > 128 ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !Buffer.isBuffer(input.signingKey) || input.signingKey.length < 32) {
    throw new CrewCommitGateError('Invalid crew PIN issuer request', 400)
  }
  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: input.crewDispatchId },
    select: { jobId: true, companyId: true },
  })
  if (!key) throw new CrewCommitGateError('Crew booking not found', 404)
  // Lock current account before quoting the booking; the route preflight
  // is never sufficient authority for customer PIN issuance.
  const customers = await tx.$queryRaw<Array<{
    id: string; isActive: boolean; isSuspended: boolean; isBanned: boolean
  }>>`
    SELECT id, "isActive", "isSuspended", "isBanned"
    FROM "User" WHERE id = ${input.authenticatedCustomerUserId} FOR UPDATE
  `
  if (customers.length !== 1 || customers[0].id !== input.authenticatedCustomerUserId ||
      !customers[0].isActive ||
      customers[0].isSuspended || customers[0].isBanned) {
    throw new CrewCommitGateError('Customer is not authorized to issue crew PINs', 403)
  }
  const quotes = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "JobQuote"
    WHERE "jobId" = ${key.jobId} AND "providerId" = ${key.companyId}
      AND "providerType" = 'COMPANY' AND status = 'ACCEPTED'
    FOR SHARE
  `
  if (quotes.length !== 1) throw new CrewCommitGateError('Crew accepted quote changed')
  const jobs = await tx.$queryRaw<Array<{
    id: string; customerId: string; status: string; workersCount: number
    countryCode: string; latitude: number | null; longitude: number | null
    targetTaskerId: string | null
    preferredDate: Date | null; preferredTimeSlot: string | null
  }>>`
    SELECT id, "customerId", status, "workersCount", "countryCode",
      latitude, longitude, "targetTaskerId", "preferredDate", "preferredTimeSlot"
    FROM "MarketplaceJob" WHERE id = ${key.jobId} FOR UPDATE
  `
  const crews = await tx.$queryRaw<Array<{
    id: string; companyId: string; jobId: string; version: number
    status: string; requiredWorkersCount: number; leadWorkerUserId: string | null
  }>>`
    SELECT id, "companyId", "jobId", version, status,
      "requiredWorkersCount", "leadWorkerUserId"
    FROM "CompanyCrewDispatch" WHERE id = ${input.crewDispatchId} FOR UPDATE
  `
  const job = jobs[0], crew = crews[0]
  if (!job || job.customerId !== input.authenticatedCustomerUserId) {
    throw new CrewCommitGateError('Crew booking not found', 404)
  }
  if (!crew || crew.companyId !== key.companyId || crew.jobId !== job.id ||
      crew.status !== 'FORMING' || crew.version !== input.expectedVersion ||
      job.status !== 'QUOTE_ACCEPTED' || job.workersCount !== crew.requiredWorkersCount ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) {
    throw new CrewCommitGateError('Crew booking or roster epoch changed')
  }
  const company = await tx.companyProfile.findUnique({
    where: { id: key.companyId },
    select: { countryCode: true, userId: true },
  })
  const market = requireJobMarket(job)
  if (!market.ok || !company ||
      company.countryCode.trim().toUpperCase() !== market.countryCode ||
      (job.targetTaskerId && ![key.companyId, company.userId].includes(job.targetTaskerId))) {
    throw new CrewCommitGateError('Crew company or market is no longer valid')
  }
  const eligibleCompany = await checkCompanyEligibility(key.companyId, tx)
  if (!eligibleCompany.eligible) throw new CrewCommitGateError('Crew company is no longer eligible')
  const [oldArrival, legacyPin, safety, existing] = await Promise.all([
    tx.jobVerificationPin.findFirst({
      where: { jobId: job.id, arrivalVerifiedAt: { not: null } },
      select: { id: true },
    }),
    tx.jobVerificationPin.findFirst({
      where: { jobId: job.id, status: 'ACTIVE' },
      select: { id: true },
    }),
    tx.jobWorkerIdentityCheck.findFirst({
      where: { jobId: job.id, status: { in: ['MISMATCH_REPORTED', 'REVIEW_REQUIRED'] } },
      select: { id: true },
    }),
    tx.companyCrewPinChallenge.count({
      where: { crewDispatchId: crew.id, crewVersion: crew.version, purpose: 'ARRIVAL' },
    }),
  ])
  if (oldArrival || legacyPin || safety || existing > 0) {
    throw new CrewCommitGateError('Crew arrival PINs cannot be issued again or during safety review')
  }
  const slots = await tx.companyJobAssignment.findMany({
    where: { crewDispatchId: crew.id },
    select: {
      id: true, workerUserId: true, companyId: true, jobId: true,
      status: true, acceptedAt: true, crewIdentityConfirmedAt: true,
      crewSlot: true, crewRole: true, crewArrivedAt: true, startedAt: true,
    },
  })
  if (slots.length !== crew.requiredWorkersCount ||
      new Set(slots.map(s => s.workerUserId)).size !== slots.length ||
      new Set(slots.map(s => s.crewSlot)).size !== slots.length ||
      slots.filter(s => s.crewRole === 'LEAD').length !== 1 ||
      slots.find(s => s.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId ||
      slots.some(s => s.jobId !== job.id || s.companyId !== key.companyId ||
        !s.crewSlot || s.status !== 'CREW_ACCEPTED' || !s.acceptedAt ||
        !s.crewIdentityConfirmedAt || s.crewIdentityConfirmedAt < s.acceptedAt ||
        s.crewArrivedAt !== null || s.startedAt !== null)) {
    throw new CrewCommitGateError('Every crew member must accept and have current photo approval')
  }
  const sorted = [...slots].sort((a,b) => a.workerUserId.localeCompare(b.workerUserId))
  for (const slot of sorted) {
    await lockAndAssertWorkerScheduleAvailable(
      tx, slot.workerUserId, job.id, job.preferredDate,
      job.preferredTimeSlot, key.companyId, true,
    )
    const workerEligible = await checkCrewCandidateEligibility(
      key.companyId, slot.workerUserId, job.id, tx,
    )
    if (!workerEligible.eligible) throw new CrewCommitGateError('Crew worker is no longer eligible')
    const photo = await tx.providerIdentity.findFirst({
      where: {
        currentUserId: slot.workerUserId,
        identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
        kycStatus: 'VERIFIED', verifiedPhotoUrl: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, verifiedPhotoUrl: true },
    })
    if (!photo?.verifiedPhotoUrl) throw new CrewCommitGateError('Crew worker photo withdrawn')
    const match = await tx.jobWorkerIdentityCheck.findUnique({
      where: { jobId_providerIdentityId: {
        jobId: job.id, providerIdentityId: photo.id,
      } },
      select: {
        status: true, assignedWorkerUserId: true, confirmedAt: true,
        photoSnapshotUrl: true,
      },
    })
    if (!match || match.status !== 'MATCHED' ||
        match.assignedWorkerUserId !== slot.workerUserId ||
        match.photoSnapshotUrl !== photo.verifiedPhotoUrl ||
        !match.confirmedAt || match.confirmedAt < slot.acceptedAt! ||
        match.confirmedAt > slot.crewIdentityConfirmedAt!) {
      throw new CrewCommitGateError('Crew worker photo confirmation is missing or stale')
    }
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  const codes = sorted.map(slot => {
    const pin = generateCrewPinCode()
    return {
      assignmentId: slot.id, pin,
      digest: deriveCrewPinDigest(pin, {
        crewDispatchId: crew.id, jobId: job.id, crewVersion: crew.version,
        assignmentId: slot.id, workerUserId: slot.workerUserId,
        purpose: 'ARRIVAL',
      }, input.signingKey),
    }
  })
  const issued = await tx.companyCrewPinChallenge.createMany({
    data: codes.map(row => ({
      crewDispatchId: crew.id, jobId: job.id, crewVersion: crew.version,
      assignmentId: row.assignmentId,
      purpose: 'ARRIVAL', challengeVersion: 1, pinDigest: row.digest,
      issuedByCustomerUserId: input.authenticatedCustomerUserId,
      expiresAt,
    })),
  })
  if (issued.count !== crew.requiredWorkersCount) {
    throw new CrewCommitGateError('Crew PINs must be issued atomically for all workers')
  }
  await writeCompanyAuditLog({
    companyId: key.companyId, actorId: input.authenticatedCustomerUserId,
    actorRole: 'CUSTOMER', action: 'CREW_ARRIVAL_CHALLENGES_ISSUED',
    targetType: 'CompanyCrewDispatch', targetId: crew.id,
    description: 'Customer issued distinct internal crew PIN challenges; arrival and work remain disabled',
    metadata: {
      jobId: job.id, crewVersion: crew.version, workerCount: issued.count,
    },
  }, tx)
  return {
    crewDispatchId: crew.id, crewVersion: crew.version,
    memberCodes: codes.map(row => ({ assignmentId: row.assignmentId, pin: row.pin })),
    arrivalEnabled: false, workStartEnabled: false,
  }
}
