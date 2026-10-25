import type { Prisma } from '@prisma/client'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'

/** Applies an approved commission waiver as compensating, balanced ledger entries. */
export async function applyMarketplaceDisputeCorrectionInTransaction(
  tx: Prisma.TransactionClient,
  input: { disputeId: string; receivableId: string; amountMinor: bigint; reason: string; approvalRequestId: string; adminId: string },
) {
  await tx.$queryRaw`SELECT id FROM "MarketplaceDispute" WHERE id = ${input.disputeId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "ProviderCommissionReceivable" WHERE id = ${input.receivableId} FOR UPDATE`
  const approval = await tx.crmApprovalRequest.findUnique({ where: { id: input.approvalRequestId }, select: { actionId: true, status: true, targetType: true, targetId: true, amountMinor: true, initiatorAdminId: true } })
  if (!approval || !['APPROVED', 'EXECUTING'].includes(approval.status) || approval.actionId !== 'disputes.financial_resolution' || approval.targetType !== 'MarketplaceDispute' || approval.targetId !== input.disputeId || approval.amountMinor !== input.amountMinor || approval.initiatorAdminId === input.adminId) {
    throw new Error('CORRECTION_APPROVAL_INVALID')
  }
  const [dispute, receivable] = await Promise.all([
    tx.marketplaceDispute.findUnique({
      where: { id: input.disputeId },
      select: { id: true, status: true, countryCode: true, job: { select: { id: true, countryCode: true } } },
    }),
    tx.providerCommissionReceivable.findUnique({
      where: { id: input.receivableId },
      select: { id: true, jobId: true, providerIdentityId: true, currency: true, amountRemaining: true, amountWaived: true, status: true, providerIdentity: { select: { countryCode: true } } },
    }),
  ])
  if (!dispute || !receivable) throw new Error('CORRECTION_TARGET_NOT_FOUND')
  if (dispute.job.id !== receivable.jobId) throw new Error('CORRECTION_JOB_MISMATCH')
  const market = (dispute.countryCode || dispute.job.countryCode).toUpperCase()
  if (market !== dispute.job.countryCode.toUpperCase() || market !== receivable.providerIdentity.countryCode.toUpperCase()) {
    throw new Error('CORRECTION_MARKET_MISMATCH')
  }
  if (!['OPEN', 'UNDER_REVIEW', 'RESOLVING'].includes(dispute.status)) throw new Error('CORRECTION_CASE_NOT_ACTIVE')
  if (!['OPEN', 'PARTIAL'].includes(receivable.status) || input.amountMinor <= 0n || input.amountMinor > receivable.amountRemaining) {
    throw new Error('CORRECTION_EXCEEDS_OUTSTANDING')
  }
  if (!input.reason.trim() || input.reason.length > 1000) throw new Error('CORRECTION_REASON_INVALID')

  const correction = await tx.marketplaceDisputeCorrection.create({
    data: {
      disputeId: dispute.id, receivableId: receivable.id, approvalRequestId: input.approvalRequestId,
      amountMinor: input.amountMinor, currency: receivable.currency, reason: input.reason.trim(), appliedByAdminId: input.adminId,
    },
  })
  const remaining = receivable.amountRemaining - input.amountMinor
  await tx.providerCommissionReceivable.update({
    where: { id: receivable.id },
    data: { amountRemaining: remaining, amountWaived: receivable.amountWaived + input.amountMinor, status: remaining === 0n ? 'WAIVED' : 'PARTIAL' },
  })
  const account = await tx.providerFinancialAccount.updateMany({
    where: { providerIdentityId: receivable.providerIdentityId, currency: receivable.currency, commissionDue: { gte: input.amountMinor } },
    data: { commissionDue: { decrement: input.amountMinor }, version: { increment: 1 } },
  })
  if (account.count !== 1) throw new Error('CORRECTION_ACCOUNT_BALANCE_MISMATCH')
  await postLedgerTransaction({
    entries: [
      { accountId: `provider-receivable:${receivable.providerIdentityId}`, accountType: 'PROVIDER_COMMISSION_RECEIVABLE', entryType: 'CREDIT', amount: input.amountMinor },
      { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: input.amountMinor },
    ],
    referenceType: 'MARKETPLACE_DISPUTE_COMMISSION_WAIVER', referenceId: correction.id,
    idempotencyKey: `marketplace-dispute-correction:${input.approvalRequestId}`,
    currency: receivable.currency as 'LKR' | 'CAD', description: 'Approved dispute commission waiver', createdBy: input.adminId,
    metadata: JSON.stringify({ disputeId: dispute.id, receivableId: receivable.id, approvalRequestId: input.approvalRequestId }),
  }, tx)
  await tx.marketplaceDisputeCorrectionEvent.create({
    data: { correctionId: correction.id, eventType: 'COMMISSION_WAIVER_APPLIED', actorAdminId: input.adminId, metadata: JSON.stringify({ amountMinor: input.amountMinor.toString(), remainingMinor: remaining.toString(), approvalRequestId: input.approvalRequestId }) },
  })
  await tx.jobLifecycleEvent.create({
    data: { jobId: dispute.job.id, actorId: input.adminId, actorType: 'STAFF', action: 'DISPUTE_FINANCIAL_CORRECTION_APPLIED', fromState: dispute.status, toState: dispute.status, metadata: JSON.stringify({ disputeId: dispute.id, correctionId: correction.id, correctionType: 'COMMISSION_WAIVER', amountMinor: input.amountMinor.toString(), currency: receivable.currency, approvalRequestId: input.approvalRequestId }) },
  })
  return correction
}
