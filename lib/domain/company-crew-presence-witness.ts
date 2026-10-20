import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { assertAllCrewPinClaimsInsideTransaction } from '@/lib/domain/company-crew-pin-claims'

const MAX_ATTESTATION_AGE_MS = 10 * 60 * 1000

/**
 * INTERNAL read-only audit of independently recorded customer + worker
 * acknowledgements AFTER each member's consumed epoch-bound ARRIVAL PIN.
 * These are statements, not proof of GPS accuracy, actual co-presence or
 * identity of a person holding a device.
 *
 * The caller must own a SERIALIZABLE transaction and supply the authenticated
 * manager, never an arbitrary body-provided actor. Absolutely no route,
 * arrival/READY transition, workspace, job or payment authority is conferred.
 */
export async function assertCrewDualWitnessInventoryInsideTransaction(
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
  membersWithDualWitnesses: number
  dualAttestationsCollected: true
  physicalPresenceVerified: false
  arrivalEnabled: false
  workStartEnabled: false
}> {
  // Revalidates company/manager authority, every worker's live membership,
  // fresh verified photo, exact customer match and consumed challenge scope.
  const claims = await assertAllCrewPinClaimsInsideTransaction(tx, input)
  const crew = await tx.companyCrewDispatch.findUnique({
    where: { id: claims.crewDispatchId },
    select: { jobId: true },
  })
  if (!crew) throw new CrewCommitGateError('Crew changed before dual witness review')
  const [job, roster, witnesses, pins] = await Promise.all([
    tx.marketplaceJob.findUnique({
      where: { id: crew.jobId }, select: { customerId: true },
    }),
    tx.companyJobAssignment.findMany({
      where: { crewDispatchId: claims.crewDispatchId },
      select: {
        id: true, workerUserId: true, status: true,
        startedAt: true, crewArrivedAt: true,
      },
    }),
    tx.companyCrewPresenceWitness.findMany({
      where: {
        crewDispatchId: claims.crewDispatchId, crewVersion: claims.crewVersion,
      },
    }),
    tx.companyCrewPinChallenge.findMany({
      where: {
        crewDispatchId: claims.crewDispatchId,
        crewVersion: claims.crewVersion, purpose: 'ARRIVAL',
      },
      select: {
        assignmentId: true, consumedAt: true, revokedAt: true, expiresAt: true,
      },
    }),
  ])
  if (!job || roster.length < 2 || roster.length > 12 ||
      witnesses.length !== roster.length || pins.length !== roster.length ||
      new Set(roster.map(s => s.id)).size !== roster.length ||
      new Set(witnesses.map(w => w.assignmentId)).size !== witnesses.length ||
      new Set(pins.map(p => p.assignmentId)).size !== pins.length ||
      roster.some(s => s.status !== 'CREW_ACCEPTED' ||
        s.startedAt !== null || s.crewArrivedAt !== null)) {
    throw new CrewCommitGateError('Full crew dual witness evidence is incomplete')
  }

  const now = Date.now()
  const witnessBySlot = new Map(witnesses.map(w => [w.assignmentId, w]))
  const pinBySlot = new Map(pins.map(p => [p.assignmentId, p]))
  const moments: number[] = []
  for (const slot of roster) {
    const witness = witnessBySlot.get(slot.id)
    const pin = pinBySlot.get(slot.id)
    if (!witness || !pin || !pin.consumedAt ||
        pin.revokedAt !== null ||
        witness.jobId !== crew.jobId ||
        witness.crewDispatchId !== claims.crewDispatchId ||
        witness.crewVersion !== claims.crewVersion ||
        witness.workerUserId !== slot.workerUserId ||
        witness.customerUserId !== job.customerId ||
        !witness.customerAttestedAt || !witness.workerAttestedAt) {
      throw new CrewCommitGateError('Crew witness subject or epoch is not current')
    }
    const pinUsedAt = pin.consumedAt.getTime()
    const workerAt = witness.workerAttestedAt.getTime()
    const customerAt = witness.customerAttestedAt.getTime()
    // Both people must independently have attested after this worker's PIN
    // consumption and while the original challenge was valid. Recentness
    // matters: an old group claim cannot be replayed on a later date.
    if (!Number.isFinite(pinUsedAt) || !Number.isFinite(workerAt) ||
        !Number.isFinite(customerAt) ||
        pinUsedAt > pin.expiresAt.getTime() ||
        workerAt < pinUsedAt || customerAt < pinUsedAt ||
        workerAt > now || customerAt > now ||
        now - workerAt > MAX_ATTESTATION_AGE_MS ||
        now - customerAt > MAX_ATTESTATION_AGE_MS ||
        Math.abs(workerAt - customerAt) > MAX_ATTESTATION_AGE_MS) {
      throw new CrewCommitGateError('Crew witness timing is stale or inconsistent')
    }
    moments.push(workerAt, customerAt)
  }
  if (Math.max(...moments) - Math.min(...moments) > MAX_ATTESTATION_AGE_MS) {
    throw new CrewCommitGateError('Crew member witness times are not within one window')
  }
  return {
    crewDispatchId: claims.crewDispatchId,
    crewVersion: claims.crewVersion,
    membersWithDualWitnesses: roster.length,
    dualAttestationsCollected: true,
    physicalPresenceVerified: false,
    arrivalEnabled: false,
    workStartEnabled: false,
  }
}
