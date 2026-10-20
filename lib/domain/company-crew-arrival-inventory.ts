import { Prisma } from '@prisma/client'
import { assertStagedCrewIdentityEvidenceInsideTransaction } from '@/lib/domain/company-crew-barrier'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'

/**
 * INTERNAL read-only pre-arrival challenge inventory. No public API calls it.
 * Caller MUST use the same SERIALIZABLE transaction throughout. Upstream
 * identity barrier locks manager, accepted quote, booking, crew epoch and every
 * worker/photo. A positive result never proves presence or authorizes work.
 */
export async function assertCrewArrivalChallengeInventoryInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    crewDispatchId: string
    expectedVersion: number
    actorUserId: string
    actorRole: string
  },
): Promise<{
  crewDispatchId: string
  crewVersion: number
  memberChallengesReady: true
  pendingMemberCount: number
  arrivalEnabled: false
  workStartEnabled: false
}> {
  const gate = await assertStagedCrewIdentityEvidenceInsideTransaction(tx, input)
  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: gate.crewDispatchId }, select: { jobId: true },
  })
  if (!key) throw new CrewCommitGateError('Crew challenge booking changed')

  const [booking, slots, challenges] = await Promise.all([
    tx.marketplaceJob.findUnique({
      where: { id: key.jobId }, select: { customerId: true },
    }),
    tx.companyJobAssignment.findMany({
      where: { crewDispatchId: gate.crewDispatchId },
      select: { id: true, workerUserId: true, status: true, crewArrivedAt: true },
    }),
    tx.companyCrewPinChallenge.findMany({
      where: {
        crewDispatchId: gate.crewDispatchId,
        crewVersion: gate.version,
        purpose: 'ARRIVAL',
      },
      orderBy: { challengeVersion: 'desc' },
    }),
  ])
  if (!booking || slots.length !== gate.requiredWorkersCount ||
      new Set(slots.map(s => s.workerUserId)).size !== slots.length ||
      slots.some(s => s.status !== 'CREW_ACCEPTED' || s.crewArrivedAt !== null)) {
    throw new CrewCommitGateError('Crew arrival challenge roster changed')
  }
  const validIds = new Set(slots.map(s => s.id))
  if (challenges.some(c => !validIds.has(c.assignmentId))) {
    throw new CrewCommitGateError('Crew arrival challenge belongs to an obsolete assignment')
  }

  const now = Date.now()
  for (const slot of slots) {
    const memberChallenges = challenges.filter(row => row.assignmentId === slot.id)
    const latest = memberChallenges[0]
    if (!latest || latest.jobId !== key.jobId ||
        latest.crewVersion !== gate.version ||
        latest.issuedByCustomerUserId !== booking.customerId ||
        latest.purpose !== 'ARRIVAL' ||
        latest.challengeVersion < 1 ||
        !/^[a-f0-9]{64}$/.test(latest.pinDigest) ||
        latest.createdAt.getTime() >= latest.expiresAt.getTime() ||
        latest.expiresAt.getTime() <= now ||
        latest.revokedAt !== null || latest.consumedAt !== null ||
        latest.failedAttempts >= 5 ||
        (latest.lockedUntil !== null && latest.lockedUntil.getTime() > now) ||
        memberChallenges.some((row, index) =>
          index > 0 && row.revokedAt === null && row.consumedAt === null)) {
      throw new CrewCommitGateError('Every worker needs a current, unused arrival challenge')
    }
  }
  return {
    crewDispatchId: gate.crewDispatchId,
    crewVersion: gate.version,
    memberChallengesReady: true,
    pendingMemberCount: gate.requiredWorkersCount,
    arrivalEnabled: false,
    workStartEnabled: false,
  }
}
