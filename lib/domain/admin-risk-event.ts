import { Prisma, PrismaClient } from '@prisma/client'
import type { AdminSession, AuditAction } from '../admin-types'

/**
 * A standard CRM risk-event "reviewed" bit is NOT authority to close a
 * consumed-PIN crew safety hold. It would remove the only pending HIGH event
 * from the triage inventory while worker capacity remains safety-reserved.
 * Keep that event visible until a separate, explicitly approved, atomic
 * support resolution/capacity policy exists.
 */
export class CrewSafetyCaseRequiresDedicatedResolutionError extends Error {
  constructor() {
    super('Crew safety case requires dedicated resolution')
    this.name = 'CrewSafetyCaseRequiresDedicatedResolutionError'
  }
}

type ZeroHoldMismatchClaim = {
  companyId: string
  crewId: string
  assignmentId: string
  workerUserId: string
  previousVersion: number
  blockedVersion: number
}

/**
 * JSON counts are only a REQUEST to use ordinary CRM review, never proof of
 * safety. Verify the authoritative whole crew, all historical PINs, and
 * retained work/scheduling evidence before any reviewedAt write. Callers
 * should use a SERIALIZABLE transaction to prevent concurrent roster changes
 * between this read and the review update.
 */
async function assertPersistedNoHeldCrewEvidence(
  tx: PrismaClient | Prisma.TransactionClient,
  jobId: string | null,
  m: ZeroHoldMismatchClaim,
) {
  const deny = () => { throw new CrewSafetyCaseRequiresDedicatedResolutionError() }
  if (!jobId) return deny()
  const crew = await tx.companyCrewDispatch.findUnique({
    where: { id: m.crewId },
    select: {
      jobId: true, companyId: true, version: true,
      status: true, requiredWorkersCount: true,
    },
  })
  if (!crew || crew.jobId !== jobId || crew.companyId !== m.companyId ||
      crew.status !== 'BLOCKED' || crew.version !== m.blockedVersion ||
      crew.requiredWorkersCount < 2 || crew.requiredWorkersCount > 12) return deny()

  const [roster, consumed, witnesses, workspace, legacyArrival] = await Promise.all([
    tx.companyJobAssignment.findMany({
      where: { crewDispatchId: m.crewId },
      select: {
        id: true, jobId: true, companyId: true, workerUserId: true,
        status: true, startedAt: true, crewArrivedAt: true,
      },
    }),
    tx.companyCrewPinChallenge.findFirst({
      where: { crewDispatchId: m.crewId, consumedAt: { not: null } },
      select: { id: true },
    }),
    tx.companyCrewPresenceWitness.findFirst({
      where: { crewDispatchId: m.crewId },
      select: { id: true },
    }),
    tx.jobWorkspace.findUnique({
      where: { jobId }, select: { id: true },
    }),
    tx.jobVerificationPin.findFirst({
      where: { jobId, arrivalVerifiedAt: { not: null } },
      select: { id: true },
    }),
  ])
  if (consumed || witnesses || workspace || legacyArrival ||
      roster.length !== crew.requiredWorkersCount ||
      new Set(roster.map(s => s.id)).size !== roster.length ||
      new Set(roster.map(s => s.workerUserId)).size !== roster.length ||
      !roster.some(s => s.id === m.assignmentId &&
        s.workerUserId === m.workerUserId) ||
      roster.some(s => s.jobId !== jobId || s.companyId !== m.companyId ||
        s.status !== 'REVOKED' || s.startedAt !== null ||
        s.crewArrivedAt !== null)) return deny()
}

function assertGenericRiskReviewDoesNotCloseCrewSafetyHold(
  event: { eventType: string; metadata: string | null },
): ZeroHoldMismatchClaim | null {
  if (event.eventType === 'CREW_CONSUMED_PIN_SAFETY_HOLD' ||
      event.eventType === 'CREW_WORKFORCE_PIN_SAFETY_HOLD') {
    // These events only originate from evidence-preserving holds.
    throw new CrewSafetyCaseRequiresDedicatedResolutionError()
  }
  if (event.eventType !== 'WORKER_IDENTITY_MISMATCH') return null

  // Ordinary pre-arrival customer mismatch may release the roster BEFORE
  // any PIN was consumed. Such non-held risk events retain normal review.
  // Malformed/legacy metadata must fail CLOSED: never assume there was no
  // consumed PIN and no capacity held.
  let metadata: unknown
  try {
    metadata = JSON.parse(event.metadata || '')
  } catch {
    throw new CrewSafetyCaseRequiresDedicatedResolutionError()
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new CrewSafetyCaseRequiresDedicatedResolutionError()
  }
  const m = metadata as Record<string, unknown>
  if (m.consumedPinsPreserved !== 0 ||
      m.capacityHeldForReview !== 0 ||
      typeof m.companyId !== 'string' || !m.companyId.trim() ||
      typeof m.crewId !== 'string' || !m.crewId.trim() ||
      typeof m.assignmentId !== 'string' || !m.assignmentId.trim() ||
      typeof m.workerUserId !== 'string' || !m.workerUserId.trim() ||
      typeof m.previousVersion !== 'number' ||
      !Number.isSafeInteger(m.previousVersion) || m.previousVersion < 1 ||
      m.blockedVersion !== m.previousVersion + 1) {
    throw new CrewSafetyCaseRequiresDedicatedResolutionError()
  }
  return {
    companyId: m.companyId, crewId: m.crewId,
    assignmentId: m.assignmentId, workerUserId: m.workerUserId,
    previousVersion: m.previousVersion, blockedVersion: m.blockedVersion,
  } as ZeroHoldMismatchClaim
}

export type RiskEventResolution = 'CONFIRMED' | 'DISMISSED' | 'ESCALATED' | 'NO_ACTION'

export interface ReviewRiskEventInput {
  eventId: string
  resolution: RiskEventResolution
  reason?: string
  session: AdminSession
  ipAddress: string
}

export async function reviewRiskEvent(
  tx: PrismaClient | Prisma.TransactionClient,
  input: ReviewRiskEventInput
) {
  const { eventId, resolution, reason, session, ipAddress } = input

  const validResolutions: RiskEventResolution[] = ['CONFIRMED', 'DISMISSED', 'ESCALATED', 'NO_ACTION']
  if (!validResolutions.includes(resolution)) {
    throw new Error(`Invalid resolution: ${resolution}`)
  }

  if ((resolution === 'CONFIRMED' || resolution === 'ESCALATED') && (!reason || reason.trim().length < 3)) {
    throw new Error('Reason is required for CONFIRMED/ESCALATED resolution')
  }

  const event = await tx.marketplaceRiskEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true, eventType: true, severity: true,
      resolution: true, reviewedAt: true, actorUserId: true, metadata: true,
      jobId: true,
    },
  })

  if (!event) throw new Error('Risk event not found')

  if (event.reviewedAt) {
    throw new Error(`Risk event already reviewed: ${event.resolution}`)
  }

  // Fail before setting reviewedAt, touching provider standing or writing an
  // audit "resolution". Neither DISMISSED/NO_ACTION nor ESCALATED/CONFIRMED
  // may silently consume a pending held-crew HIGH safety event.
  const zeroHold = assertGenericRiskReviewDoesNotCloseCrewSafetyHold(event)
  if (zeroHold) {
    await assertPersistedNoHeldCrewEvidence(tx, event.jobId, zeroHold)
  }

  const oldValue = { resolution: event.resolution, reviewedAt: null }
  const newValue = { resolution, reviewedAt: new Date(), reason }

  const updateResult = await tx.marketplaceRiskEvent.updateMany({
    where: { id: eventId, reviewedAt: null },
    data: {
      resolution,
      reviewedAt: new Date(),
      reviewedBy: session.id,
    },
  })

  if (updateResult.count === 0) {
    throw new Error('Concurrent risk event decision detected — another admin already reviewed this event.')
  }

  const actionMap: Record<string, AuditAction> = {
    CONFIRMED: 'RISK_EVENT_RESOLVE',
    DISMISSED: 'RISK_EVENT_DISMISS',
    ESCALATED: 'RISK_EVENT_ESCALATE',
    NO_ACTION: 'RISK_EVENT_RESOLVE',
  }

  if (event.metadata) {
    try {
      const metadata = JSON.parse(event.metadata)
      const providerIntegritySignalId =
        typeof metadata?.providerIntegritySignalId === 'string'
          ? metadata.providerIntegritySignalId
          : null

      if (providerIntegritySignalId) {
        const mappedStatus =
          resolution === 'DISMISSED' || resolution === 'NO_ACTION'
            ? 'DISMISSED'
            : resolution === 'CONFIRMED'
              ? 'CONFIRMED'
              : 'REVIEWED'

        const signal = await tx.providerIntegritySignal.findUnique({
          where: { id: providerIntegritySignalId },
          select: { providerIdentityId: true },
        })

        if (signal) {
          await tx.providerIntegritySignal.update({
            where: { id: providerIntegritySignalId },
            data: {
              status: mappedStatus,
              resolution,
              reviewedAt: new Date(),
              reviewedBy: session.id,
            },
          })

          if (mappedStatus === 'DISMISSED' && signal.providerIdentityId) {
            const remainingBlocking = await tx.providerIntegritySignal.count({
              where: {
                providerIdentityId: signal.providerIdentityId,
                id: { not: providerIntegritySignalId },
                status: { in: ['OPEN', 'REVIEWED', 'CONFIRMED'] },
                severity: { in: ['HIGH', 'CRITICAL'] },
              },
            })
            if (remainingBlocking === 0) {
              await tx.providerIdentity.updateMany({
                where: {
                  id: signal.providerIdentityId,
                  standingStatus: 'REVIEW_REQUIRED',
                },
                data: { standingStatus: 'ACTIVE' },
              })
            }
          }
        }
      }
    } catch {
      // Risk-event metadata is best-effort; malformed legacy metadata must not
      // prevent the primary CRM review from completing.
    }
  }

  await tx.auditLog.create({
    data: {
      adminUserId: session.id,
      adminEmail: session.email,
      adminRole: session.role,
      action: actionMap[resolution] || 'UPDATE',
      targetTable: 'MarketplaceRiskEvent',
      targetId: eventId,
      targetLabel: `${event.eventType} (${event.severity})`,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(newValue),
      ipAddress,
    },
  })

  return { success: true, eventId, resolution, event }
}
