import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'

/**
 * Caller MUST own the SERIALIZABLE job->crew epoch locks. Revoke every still
 * unused challenge in the SAME transaction as a whole-crew cancellation,
 * refusal, workforce change, or safety hold. Never delete PIN evidence.
 *
 * A consumed individual claim is safety evidence: an ordinary roster
 * cancellation/removal must return 409 rather than silently discard it.
 * Customer identity MISMATCH can always place a safety hold: with
 * allowConsumedEvidence=true it keeps consumed claims immutable and
 * revokes the remaining unconsumed codes.
 */
export async function revokeCrewPinChallengesInsideTransaction(
  tx: Prisma.TransactionClient,
  input: {
    crewDispatchId: string
    crewVersion: number
    allowConsumedEvidence?: boolean
  },
): Promise<{ revokedPinChallenges: number; consumedClaimsPreserved: number }> {
  if (!input.crewDispatchId || input.crewDispatchId.length > 128 ||
      !Number.isSafeInteger(input.crewVersion) || input.crewVersion < 1) {
    throw new CrewCommitGateError('Invalid crew PIN revocation scope', 400)
  }
  const rows = await tx.companyCrewPinChallenge.findMany({
    where: { crewDispatchId: input.crewDispatchId, crewVersion: input.crewVersion },
    select: { id: true, consumedAt: true, revokedAt: true },
  })
  const consumed = rows.filter(row => row.consumedAt !== null)
  if (consumed.length && !input.allowConsumedEvidence) {
    throw new CrewCommitGateError('Crew worker PIN claim requires support review before roster change')
  }
  const live = rows.filter(row => row.consumedAt === null && row.revokedAt === null)
  if (live.length) {
    const written = await tx.companyCrewPinChallenge.updateMany({
      where: {
        id: { in: live.map(row => row.id) },
        crewDispatchId: input.crewDispatchId,
        crewVersion: input.crewVersion,
        consumedAt: null, revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })
    if (written.count !== live.length) {
      throw new CrewCommitGateError('Crew PIN challenge changed concurrently')
    }
  }
  return {
    revokedPinChallenges: live.length,
    consumedClaimsPreserved: consumed.length,
  }
}
