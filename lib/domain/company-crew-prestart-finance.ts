import { Prisma } from '@prisma/client'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { assertCrewDualWitnessInventoryInsideTransaction } from '@/lib/domain/company-crew-presence-witness'

/**
 * INTERNAL, READ-ONLY financial/workspace prestart diagnostics. Caller must
 * hold a single SERIALIZABLE transaction across this and any future write;
 * this result is NOT a reusable authorization token. The upstream witness
 * barrier rechecks dispatcher role, job+crew locks, exact roster/photo,
 * customer-issued consumed PIN claims and dual actor acknowledgements.
 *
 * Crucially this never asserts physical presence or enables payment, group
 * arrival, READY, work-start, workspace creation or a job state transition.
 * Existing multiworker payment creation remains deliberately disabled.
 */
export async function assertCrewPrestartFinancialEvidenceInsideTransaction(
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
  workersCount: number
  financialEvidenceComplete: true
  independentPhysicalPresenceVerified: false
  groupArrivalEnabled: false
  workStartEnabled: false
  paymentExecutionEnabled: false
}> {
  const witnesses = await assertCrewDualWitnessInventoryInsideTransaction(tx, input)
  const crew = await tx.companyCrewDispatch.findUnique({
    where: { id: witnesses.crewDispatchId },
    select: { jobId: true, companyId: true, status: true, version: true, requiredWorkersCount: true },
  })
  if (!crew || crew.version !== witnesses.crewVersion ||
      crew.status !== 'FORMING' ||
      crew.requiredWorkersCount !== witnesses.membersWithDualWitnesses ||
      witnesses.membersWithDualWitnesses < 2 || witnesses.membersWithDualWitnesses > 12) {
    throw new CrewCommitGateError('Crew changed before financial evidence review')
  }

  // Every input is re-read within the transaction that already locked the job
  // and crew. A separate preflight followed by a write is never sufficient.
  const [job, quotes, escrows, intents, dispute, workspace] = await Promise.all([
    tx.marketplaceJob.findUnique({
      where: { id: crew.jobId },
      select: { id: true, customerId: true, status: true, workersCount: true },
    }),
    tx.jobQuote.findMany({
      where: {
        jobId: crew.jobId, providerId: crew.companyId,
        providerType: 'COMPANY', status: 'ACCEPTED',
      },
      select: { id: true, price: true, currency: true },
    }),
    tx.jobEscrow.findMany({
      where: { jobId: crew.jobId },
      select: {
        id: true, quoteId: true, customerId: true, providerId: true,
        amount: true, serviceFee: true, totalAmount: true, currency: true,
        paymentMethod: true, status: true, heldAt: true, releasedAt: true,
        refundedAt: true, cashConfirmedAt: true,
      },
    }),
    tx.paymentIntent.findMany({
      where: { jobId: crew.jobId },
      select: {
        id: true, jobId: true, customerId: true, escrowId: true,
        amount: true, currency: true, status: true, paidAt: true,
      },
    }),
    tx.marketplaceDispute.findUnique({
      where: { jobId: crew.jobId },
      select: { id: true },
    }),
    tx.jobWorkspace.findUnique({
      where: { jobId: crew.jobId },
      select: { id: true },
    }),
  ])

  const quote = quotes[0], escrow = escrows[0], intent = intents[0]
  if (!job || job.status !== 'QUOTE_ACCEPTED' ||
      job.workersCount !== crew.requiredWorkersCount ||
      quotes.length !== 1 || escrows.length !== 1 || intents.length !== 1 ||
      dispute !== null || workspace !== null || !quote || !escrow || !intent) {
    throw new CrewCommitGateError('Crew booking has incomplete or conflicting finance/workspace state')
  }
  // Do NOT interpret a cash promise, a pending authorization, gateway receipt
  // alone, a released/refunded hold or a different quote as funded escrow.
  // Cash crew policy and live gateway workflows remain separately blocked.
  const now = Date.now()
  if (quote.price <= 0n || !quote.currency ||
      escrow.quoteId !== quote.id ||
      escrow.customerId !== job.customerId ||
      escrow.providerId !== crew.companyId ||
      escrow.amount !== quote.price ||
      escrow.serviceFee < 0n ||
      escrow.totalAmount !== escrow.amount + escrow.serviceFee ||
      escrow.totalAmount <= 0n ||
      escrow.currency !== quote.currency ||
      escrow.paymentMethod !== 'CARD' ||
      escrow.status !== 'PROTECTED' ||
      !escrow.heldAt || escrow.heldAt.getTime() > now ||
      escrow.releasedAt !== null || escrow.refundedAt !== null ||
      escrow.cashConfirmedAt !== null ||
      intent.jobId !== job.id ||
      intent.customerId !== job.customerId ||
      intent.escrowId !== escrow.id ||
      intent.amount !== escrow.totalAmount ||
      intent.currency !== escrow.currency ||
      intent.status !== 'SUCCESS' ||
      !intent.paidAt || intent.paidAt.getTime() > now ||
      intent.paidAt.getTime() > escrow.heldAt.getTime()) {
    throw new CrewCommitGateError('Crew requires current matching protected and settled funding evidence')
  }
  return {
    crewDispatchId: witnesses.crewDispatchId,
    crewVersion: witnesses.crewVersion,
    workersCount: witnesses.membersWithDualWitnesses,
    financialEvidenceComplete: true,
    independentPhysicalPresenceVerified: false,
    groupArrivalEnabled: false,
    workStartEnabled: false,
    paymentExecutionEnabled: false,
  }
}
