import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

export interface CrewCustomerIdentityDecision {
  jobId: string
  crewDispatchId: string
  assignmentId: string
  customerUserId: string // ONLY sourced from authenticated session
  expectedVersion: number
  decision: 'MATCH' | 'MISMATCH'
  reason?: string
}

/**
 * Customer-confirmed identities are per assignment, not per job.
 * Every operation shares a SERIALIZABLE transaction and job->crew lock order
 * with worker accept/refuse and manager cancellation.
 *
 * This does NOT set READY, grant PINs, start work, pay, message or dispatch.
 * Reporting a mismatch blocks the entire crew and holds a Trust & Safety
 * signal even when a previously approved photo is no longer available.
 */
export async function decideCrewWorkerIdentityInsideTransaction(
  tx: Prisma.TransactionClient,
  input: CrewCustomerIdentityDecision,
): Promise<{
  status: 'FORMING' | 'BLOCKED'
  version: number
  customerConfirmed: boolean
  safetyReviewRequired: boolean
  dispatchEnabled: false
}> {
  if (!input.jobId || input.jobId.length > 128 ||
      !input.crewDispatchId || input.crewDispatchId.length > 128 ||
      !input.assignmentId || input.assignmentId.length > 128 ||
      !input.customerUserId || input.customerUserId.length > 128 ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !['MATCH', 'MISMATCH'].includes(input.decision) ||
      (input.reason !== undefined &&
        (typeof input.reason !== 'string' || input.reason.length > 250))) {
    throw new CrewCommitGateError('Invalid crew photo decision', 400)
  }

  // Deny guessed job IDs before reading any worker/crew personal information.
  const ownership = await tx.marketplaceJob.findUnique({
    where: { id: input.jobId },
    select: { customerId: true },
  })
  if (!ownership || ownership.customerId !== input.customerUserId) {
    throw new CrewCommitGateError('Crew booking not found', 404)
  }
  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: input.crewDispatchId },
    select: { jobId: true, companyId: true },
  })
  if (!key || key.jobId !== input.jobId) {
    throw new CrewCommitGateError('Crew booking not found', 404)
  }
  const quotes = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "JobQuote"
    WHERE "jobId" = ${input.jobId}
      AND "providerId" = ${key.companyId}
      AND "providerType" = 'COMPANY' AND status = 'ACCEPTED'
    FOR SHARE
  `
  if (quotes.length !== 1) throw new CrewCommitGateError('Accepted crew booking not found', 404)

  const jobs = await tx.$queryRaw<Array<{
    id: string; customerId: string; status: string; workersCount: number
  }>>`
    SELECT id, "customerId", status, "workersCount" FROM "MarketplaceJob"
    WHERE id = ${input.jobId} FOR UPDATE
  `
  const job = jobs[0]
  const crews = await tx.$queryRaw<Array<{
    id: string; companyId: string; jobId: string; status: string
    requiredWorkersCount: number; leadWorkerUserId: string | null; version: number
  }>>`
    SELECT id, "companyId", "jobId", status, "requiredWorkersCount",
      "leadWorkerUserId", version
    FROM "CompanyCrewDispatch" WHERE id = ${input.crewDispatchId} FOR UPDATE
  `
  const crew = crews[0]
  if (!job || job.customerId !== input.customerUserId ||
      job.status !== 'QUOTE_ACCEPTED' ||
      !crew || crew.status !== 'FORMING' ||
      crew.version !== input.expectedVersion ||
      crew.companyId !== key.companyId || crew.jobId !== input.jobId ||
      crew.requiredWorkersCount !== job.workersCount ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) {
    throw new CrewCommitGateError('Crew booking, status or version changed')
  }

  const slots = await tx.companyJobAssignment.findMany({
    where: { crewDispatchId: crew.id },
    select: {
      id: true, companyId: true, jobId: true,
      workerUserId: true, status: true, crewSlot: true, crewRole: true,
      acceptedAt: true, crewArrivedAt: true, startedAt: true,
    },
  })
  if (slots.length !== crew.requiredWorkersCount ||
      new Set(slots.map(slot => slot.workerUserId)).size !== slots.length ||
      new Set(slots.map(slot => slot.crewSlot)).size !== slots.length ||
      slots.filter(slot => slot.crewRole === 'LEAD').length !== 1 ||
      slots.find(slot => slot.crewRole === 'LEAD')?.workerUserId !== crew.leadWorkerUserId ||
      slots.some(slot => slot.companyId !== crew.companyId ||
        slot.jobId !== input.jobId || !slot.crewSlot ||
        !['CREW_RESERVED', 'CREW_ACCEPTED'].includes(slot.status) ||
        slot.startedAt !== null || slot.crewArrivedAt !== null)) {
    throw new CrewCommitGateError('Crew roster changed or work has already begun')
  }
  const slot = slots.find(s => s.id === input.assignmentId)
  if (!slot) throw new CrewCommitGateError('Crew member not found', 404)
  if (slot.status !== 'CREW_ACCEPTED' || !slot.acceptedAt) {
    throw new CrewCommitGateError('Worker must accept their crew invitation first')
  }

  if (input.decision === 'MATCH') {
    const unsafe = await tx.jobWorkerIdentityCheck.findFirst({
      where: {
        jobId: input.jobId,
        status: { in: ['MISMATCH_REPORTED', 'REVIEW_REQUIRED'] },
      },
      select: { id: true },
    })
    const pin = await tx.jobVerificationPin.findFirst({
      where: {
        jobId: input.jobId,
        OR: [{ status: 'ACTIVE' }, { arrivalVerifiedAt: { not: null } }],
      },
      select: { id: true },
    })
    if (unsafe || pin) {
      throw new CrewCommitGateError('Crew identity or arrival safety review blocks confirmation')
    }
  }

  const accounts = await tx.$queryRaw<Array<{
    id: string; name: string; isActive: boolean; isSuspended: boolean
    isBanned: boolean; identityStatus: string
  }>>`
    SELECT id, name, "isActive", "isSuspended", "isBanned", "identityStatus"
    FROM "User" WHERE id = ${slot.workerUserId} FOR UPDATE
  `
  const worker = accounts[0]
  const members = await tx.$queryRaw<Array<{ role: string; status: string }>>`
    SELECT role, status FROM "TeamMember"
    WHERE "companyId" = ${crew.companyId}
      AND "userId" = ${slot.workerUserId} FOR UPDATE
  `
  const memberValid = members.length === 1 &&
    members[0].status === 'ACTIVE' && members[0].role === 'WORKER'
  const accountValid = !!worker && worker.isActive &&
    !worker.isSuspended && !worker.isBanned &&
    worker.identityStatus === 'VERIFIED'

  const photo = await tx.providerIdentity.findFirst({
    where: {
      currentUserId: slot.workerUserId,
      identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
      // MATCH uses the same verified-photo selection policy as the customer
      // preview; otherwise an unrelated newer unverified record can block
      // confirmation of the photo the customer actually saw.
      ...(input.decision === 'MATCH'
        ? { kycStatus: 'VERIFIED', verifiedPhotoUrl: { not: null } }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, verifiedPhotoUrl: true, kycStatus: true,
      verifiedDisplayName: true,
    },
  })
  if (input.decision === 'MATCH' &&
      (!accountValid || !memberValid || !photo ||
        photo.kycStatus !== 'VERIFIED' || !photo.verifiedPhotoUrl)) {
    throw new CrewCommitGateError('Verified crew worker photo or membership is no longer valid')
  }

  // Do not let any later customer action hide a previously reported mismatch.
  const existing = photo ? await tx.jobWorkerIdentityCheck.findUnique({
    where: {
      jobId_providerIdentityId: {
        jobId: input.jobId, providerIdentityId: photo.id,
      },
    },
    select: { status: true },
  }) : null
  if (existing && ['MISMATCH_REPORTED', 'REVIEW_REQUIRED'].includes(existing.status)) {
    throw new CrewCommitGateError('Identity mismatch requires independent safety review')
  }

  const now = new Date()
  if (photo) {
    await tx.jobWorkerIdentityCheck.upsert({
      where: {
        jobId_providerIdentityId: {
          jobId: input.jobId, providerIdentityId: photo.id,
        },
      },
      create: {
        jobId: input.jobId,
        customerId: input.customerUserId,
        providerIdentityId: photo.id,
        assignedWorkerUserId: slot.workerUserId,
        displayNameSnapshot: photo.verifiedDisplayName || worker?.name || 'Crew member',
        photoSnapshotUrl: photo.verifiedPhotoUrl,
        status: input.decision === 'MATCH' ? 'MATCHED' : 'MISMATCH_REPORTED',
        confirmedAt: input.decision === 'MATCH' ? now : null,
        mismatchReportedAt: input.decision === 'MISMATCH' ? now : null,
        mismatchReason: input.decision === 'MISMATCH' ? input.reason?.trim() || null : null,
      },
      update: {
        customerId: input.customerUserId,
        assignedWorkerUserId: slot.workerUserId,
        displayNameSnapshot: photo.verifiedDisplayName || worker?.name || 'Crew member',
        photoSnapshotUrl: photo.verifiedPhotoUrl,
        status: input.decision === 'MATCH' ? 'MATCHED' : 'MISMATCH_REPORTED',
        confirmedAt: input.decision === 'MATCH' ? now : null,
        mismatchReportedAt: input.decision === 'MISMATCH' ? now : null,
        mismatchReason: input.decision === 'MISMATCH' ? input.reason?.trim() || null : null,
      },
    })
  }

  if (input.decision === 'MATCH') {
    const claimed = await tx.companyJobAssignment.updateMany({
      where: {
        id: slot.id, crewDispatchId: crew.id,
        companyId: crew.companyId, workerUserId: slot.workerUserId,
        status: 'CREW_ACCEPTED',
      },
      data: { crewIdentityConfirmedAt: now },
    })
    if (claimed.count !== 1) throw new CrewCommitGateError('Crew member changed during confirmation')
    await writeCompanyAuditLog({
      companyId: crew.companyId,
      actorId: input.customerUserId, actorRole: 'CUSTOMER',
      action: 'CREW_IDENTITY_CONFIRMED',
      targetType: 'CompanyJobAssignment', targetId: slot.id,
      description: 'Customer confirmed worker photo for this staged crew epoch only',
      metadata: { jobId: input.jobId, crewVersion: crew.version },
    }, tx)
    return {
      status: 'FORMING', version: crew.version,
      customerConfirmed: true, safetyReviewRequired: false,
      dispatchEnabled: false,
    }
  }

  // The safety signal and capacity release MUST commit together, even if
  // the worker lost their verified photo or active membership while pending.
  const released = await tx.companyJobAssignment.updateMany({
    where: {
      crewDispatchId: crew.id,
      status: { in: ['CREW_RESERVED', 'CREW_ACCEPTED'] },
    },
    data: {
      status: 'REVOKED', revokedAt: now,
      revokedReason: 'Customer reported a crew worker identity mismatch',
    },
  })
  if (released.count !== slots.length) {
    throw new CrewCommitGateError('Crew roster changed during safety hold')
  }
  const blocked = await tx.companyCrewDispatch.updateMany({
    where: { id: crew.id, status: 'FORMING', version: crew.version },
    data: { status: 'BLOCKED', version: { increment: 1 } },
  })
  if (blocked.count !== 1) throw new CrewCommitGateError('Crew changed during safety hold')

  await tx.providerIntegritySignal.create({
    data: {
      providerIdentityId: photo?.id ?? null,
      userId: slot.workerUserId, jobId: input.jobId,
      signalType: 'CUSTOMER_CREW_WORKER_IDENTITY_MISMATCH',
      severity: 'HIGH', source: 'CUSTOMER_APP', status: 'OPEN',
      metadata: JSON.stringify({
        companyId: crew.companyId,
        crewVersion: crew.version,
        assignmentId: slot.id, reason: input.reason?.trim() || null,
      }),
    },
  })
  await tx.marketplaceRiskEvent.create({
    data: {
      jobId: input.jobId, actorUserId: input.customerUserId,
      eventType: 'WORKER_IDENTITY_MISMATCH', severity: 'HIGH',
      metadata: JSON.stringify({
        crewId: crew.id, assignmentId: slot.id,
        workerUserId: slot.workerUserId, companyId: crew.companyId,
        reason: input.reason?.trim() || null,
      }),
    },
  })
  await writeCompanyAuditLog({
    companyId: crew.companyId,
    actorId: input.customerUserId, actorRole: 'CUSTOMER',
    action: 'CREW_IDENTITY_MISMATCH',
    targetType: 'CompanyCrewDispatch', targetId: crew.id,
    description: 'Crew blocked and all capacity released after customer safety report',
    metadata: { jobId: input.jobId, oldCrewVersion: crew.version },
  }, tx)
  return {
    status: 'BLOCKED', version: crew.version + 1,
    customerConfirmed: false, safetyReviewRequired: true,
    dispatchEnabled: false,
  }
}
