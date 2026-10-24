import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { assertStagedCrewIdentityEvidenceInsideTransaction } from '@/lib/domain/company-crew-barrier'

/**
 * INTERNAL read-only evidence check: every member independently consumed a
 * customer-issued PIN tied to the same crew epoch. This does NOT establish
 * physical presence, authorize arrival, change READY, start work, issue a
 * workspace, or permit payment. Future production activation needs separate
 * authenticated in-person attestation and group state machine.
 * Caller must own a SERIALIZABLE transaction with an authenticated manager.
 */
export async function assertAllCrewPinClaimsInsideTransaction(
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
  memberClaimsComplete: true
  physicalPresenceVerified: false
  arrivalEnabled: false
  workStartEnabled: false
}> {
  const evidence = await assertStagedCrewIdentityEvidenceInsideTransaction(tx, input)
  const key = await tx.companyCrewDispatch.findUnique({
    where: { id: evidence.crewDispatchId },
    select: { jobId: true },
  })
  if (!key) throw new CrewCommitGateError('Crew booking changed before PIN claims review')
  const [booking, slots, challenges] = await Promise.all([
    tx.marketplaceJob.findUnique({
      where: { id: key.jobId }, select: { customerId: true },
    }),
    tx.companyJobAssignment.findMany({
      where: { crewDispatchId: evidence.crewDispatchId },
      select: {
        id: true, status: true, crewArrivedAt: true, startedAt: true,
      },
    }),
    tx.companyCrewPinChallenge.findMany({
      where: { crewDispatchId: evidence.crewDispatchId, purpose: 'ARRIVAL' },
      orderBy: { challengeVersion: 'desc' },
    }),
  ])
  if (!booking || slots.length !== evidence.requiredWorkersCount ||
      slots.some(s => s.status !== 'CREW_ACCEPTED' ||
        s.crewArrivedAt !== null || s.startedAt !== null) ||
      new Set(slots.map(s => s.id)).size !== slots.length ||
      challenges.length !== evidence.requiredWorkersCount) {
    throw new CrewCommitGateError('Crew PIN claims do not cover the exact current roster')
  }
  const now = Date.now()
  const slotsById = new Set(slots.map(s => s.id))
  const claimsById = new Set<string>()
  for (const claim of challenges) {
    if (!slotsById.has(claim.assignmentId) ||
        claimsById.has(claim.assignmentId) ||
        claim.jobId !== key.jobId ||
        claim.crewVersion !== evidence.version ||
        claim.issuedByCustomerUserId !== booking.customerId ||
        claim.purpose !== 'ARRIVAL' || claim.challengeVersion < 1 ||
        !/^[a-f0-9]{64}$/.test(claim.pinDigest) ||
        claim.revokedAt !== null || claim.consumedAt === null ||
        claim.createdAt.getTime() >= claim.expiresAt.getTime() ||
        claim.consumedAt.getTime() < claim.createdAt.getTime() ||
        claim.consumedAt.getTime() > claim.expiresAt.getTime() ||
        claim.consumedAt.getTime() > now ||
        claim.failedAttempts >= 5 ||
        (claim.lockedUntil && claim.lockedUntil >= claim.consumedAt)) {
      throw new CrewCommitGateError('Every crew member must have a current independently consumed PIN claim')
    }
    claimsById.add(claim.assignmentId)
  }
  if (claimsById.size !== slotsById.size) {
    throw new CrewCommitGateError('Crew PIN claims do not cover the exact current roster')
  }
  return {
    crewDispatchId: evidence.crewDispatchId,
    crewVersion: evidence.version,
    memberClaimsComplete: true,
    physicalPresenceVerified: false,
    arrivalEnabled: false,
    workStartEnabled: false,
  }
}
