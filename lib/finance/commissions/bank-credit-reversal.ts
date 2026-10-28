import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import { evaluateProviderFinancialStanding } from '@/lib/finance/commissions/provider-financial-policy'
import { resolveProviderFinancialPolicy } from '@/lib/finance/commissions/provider-balance-service'
import { assertTrustedBankEvidenceSource } from '@/lib/finance/commissions/bank-credit-reconciliation'
import type { Currency } from '@/lib/shared/money/money'

async function withSerializableRetry<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      const serializationConflict = Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2034')
      if (!serializationConflict || attempt === 2) throw error
    }
  }
  throw new Error('BANK_REVERSAL_RETRY_EXHAUSTED')
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002')
}

async function assertApprovalDecision(
  tx: Prisma.TransactionClient,
  input: { approvalRequestId: string; bankTransactionId: string; actorAdminId: string; decision: 'APPROVE' | 'REJECT' },
  expected: { status: 'APPROVED' | 'REJECTED'; initiatedByAdminId: string; countryCode: string; currency: string; amountMinor: bigint },
) {
  const request = await tx.crmApprovalRequest.findUnique({
    where: { id: input.approvalRequestId },
    include: { decisions: { select: { adminId: true, decision: true } } },
  })
  if (
    !request || request.actionId !== 'finance.commission.reconcile' || request.status !== expected.status ||
    request.targetType !== 'CommissionBankTransaction' || request.targetId !== input.bankTransactionId ||
    request.initiatorAdminId !== expected.initiatedByAdminId || request.market !== expected.countryCode ||
    request.currency !== expected.currency || request.amountMinor !== expected.amountMinor
  ) throw new Error('BANK_REVERSAL_APPROVAL_NOT_APPROVED')
  let payload: unknown
  try { payload = JSON.parse(request.actionPayload || '') } catch { throw new Error('BANK_REVERSAL_APPROVAL_MISMATCH') }
  if (
    !payload || typeof payload !== 'object' || Array.isArray(payload) ||
    (payload as Record<string, unknown>).mode !== 'BANK_REVERSAL' ||
    (payload as Record<string, unknown>).bankTransactionId !== input.bankTransactionId ||
    !request.decisions.some(item => item.adminId === input.actorAdminId && item.decision === input.decision)
  ) throw new Error('BANK_REVERSAL_APPROVAL_MISMATCH')
}

export async function prepareCommissionBankReversal(input: {
  bankTransactionId: string
  actorAdminId: string
}) {
  try {
    return await withSerializableRetry(async tx => {
      const existing = await tx.commissionBankReversal.findUnique({
        where: { bankTransactionId: input.bankTransactionId },
        include: { allocations: true },
      })
      if (existing) return existing

      const debit = await tx.commissionBankTransaction.findUnique({
        where: { id: input.bankTransactionId },
        include: { statementImport: true },
      })
      if (!debit) throw new Error('BANK_TRANSACTION_NOT_FOUND')
      assertTrustedBankEvidenceSource(debit.statementImport)
      if (debit.direction !== 'DEBIT' || !debit.reversalOfTransactionId) throw new Error('BANK_ENTRY_NOT_REVERSAL')
      if (['RECONCILED', 'DUPLICATE'].includes(debit.status)) throw new Error('BANK_REVERSAL_TRANSACTION_ALREADY_USED')

      const original = await tx.commissionBankTransaction.findFirst({
        where: {
          sourceSystem: debit.sourceSystem,
          bankAccountRef: debit.bankAccountRef,
          transactionId: debit.reversalOfTransactionId,
        },
        include: { statementImport: true, reconciliation: { include: { allocations: { include: { receivable: true } } } } },
      })
      if (!original) throw new Error('BANK_REVERSAL_ORIGINAL_NOT_FOUND')
      assertTrustedBankEvidenceSource(original.statementImport)
      if (
        original.direction !== 'CREDIT' || original.id === debit.id ||
        original.countryCode !== debit.countryCode || original.currency !== debit.currency ||
        original.bankAccountRef !== debit.bankAccountRef || original.sourceSystem !== debit.sourceSystem
      ) throw new Error('BANK_REVERSAL_ORIGINAL_MISMATCH')
      const reconciliation = original.reconciliation
      if (!reconciliation || reconciliation.status !== 'POSTED') throw new Error('BANK_REVERSAL_ORIGINAL_NOT_POSTED')
      if (
        reconciliation.bankTransactionId !== original.id ||
        reconciliation.countryCode !== debit.countryCode || reconciliation.currency !== debit.currency ||
        reconciliation.totalAmountMinor !== original.amountMinor
      ) throw new Error('BANK_REVERSAL_RECONCILIATION_MISMATCH')
      const settledAllocationTotal = reconciliation.allocations.reduce((sum, item) => sum + item.amountMinor, 0n)
      if (settledAllocationTotal !== reconciliation.totalAmountMinor || debit.amountMinor > settledAllocationTotal) {
        throw new Error('BANK_REVERSAL_ALLOCATION_TOTAL_MISMATCH')
      }

      await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT id FROM "CommissionBankReconciliation" WHERE id = $1 FOR UPDATE', reconciliation.id,
      )
      const oldReversals = await tx.commissionBankReversal.findMany({
        where: { originalReconciliationId: reconciliation.id, status: { in: ['PENDING_REVIEW', 'POSTED'] } },
        include: { allocations: { select: { originalAllocationId: true, amountMinor: true } } },
      })
      const reservedByAllocation = new Map<string, bigint>()
      for (const old of oldReversals) for (const allocation of old.allocations) {
        reservedByAllocation.set(allocation.originalAllocationId, (reservedByAllocation.get(allocation.originalAllocationId) || 0n) + allocation.amountMinor)
      }

      let remaining = debit.amountMinor
      const allocations: Array<{ originalAllocationId: string; recoveryId: string; amountMinor: bigint }> = []
      for (const originalAllocation of [...reconciliation.allocations].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))) {
        if (remaining === 0n) break
        const alreadyReserved = reservedByAllocation.get(originalAllocation.id) || 0n
        const available = originalAllocation.amountMinor - alreadyReserved
        if (available <= 0n) continue
        const recovery = await tx.providerCommissionRecovery.findUnique({
          where: { idempotencyKey: `bank-credit:${original.id}:${originalAllocation.receivableId}` },
          select: { id: true, providerIdentityId: true, amount: true, currency: true },
        })
        if (!recovery || recovery.providerIdentityId !== reconciliation.providerIdentityId || recovery.currency !== debit.currency || recovery.amount !== originalAllocation.amountMinor) {
          throw new Error('BANK_REVERSAL_RECOVERY_LINK_MISMATCH')
        }
        const amountMinor = available < remaining ? available : remaining
        allocations.push({ originalAllocationId: originalAllocation.id, recoveryId: recovery.id, amountMinor })
        remaining -= amountMinor
      }
      if (remaining > 0n) throw new Error('BANK_REVERSAL_AMOUNT_EXCEEDS_SETTLED_CREDIT')

      const identity = await tx.providerIdentity.findUnique({
        where: { id: reconciliation.providerIdentityId },
        select: { id: true, identityType: true, countryCode: true },
      })
      if (!identity || !['TASKER', 'COMPANY'].includes(identity.identityType) || identity.countryCode !== debit.countryCode) {
        throw new Error('BANK_REVERSAL_DEBTOR_MARKET_MISMATCH')
      }
      if (reconciliation.countryCode !== debit.countryCode) throw new Error('BANK_REVERSAL_DEBTOR_MARKET_MISMATCH')

      const reversal = await tx.commissionBankReversal.create({
        data: {
          bankTransactionId: debit.id,
          originalBankTransactionId: original.id,
          originalReconciliationId: reconciliation.id,
          providerIdentityId: identity.id,
          initiatedByAdminId: input.actorAdminId,
          amountMinor: debit.amountMinor,
          currency: debit.currency,
          countryCode: debit.countryCode,
          allocations: { create: allocations },
          events: {
            create: {
              eventType: 'REVERSAL_PROPOSED',
              actorAdminId: input.actorAdminId,
              metadata: JSON.stringify({ originalTransactionId: original.transactionId, amountMinor: debit.amountMinor.toString() }),
            },
          },
        },
        include: { allocations: true },
      })
      await tx.commissionBankTransaction.updateMany({
        where: { id: debit.id, status: { in: ['UNREVIEWED', 'MATCHED'] } },
        data: { status: 'MATCHED', mismatchCode: null },
      })
      return reversal
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await prisma.commissionBankReversal.findUnique({ where: { bankTransactionId: input.bankTransactionId } })
      if (existing) return existing
    }
    throw error
  }
}

export async function postApprovedCommissionBankReversal(input: {
  bankTransactionId: string
  actorAdminId: string
  approvalRequestId: string
}) {
  return withSerializableRetry(async tx => {
    const reversal = await tx.commissionBankReversal.findUnique({
      where: { bankTransactionId: input.bankTransactionId },
      include: {
        bankTransaction: { include: { statementImport: true } },
        originalBankTransaction: { include: { statementImport: true, reconciliation: true } },
        originalReconciliation: true,
        allocations: { include: { originalAllocation: { include: { receivable: true } }, recovery: true } },
      },
    })
    if (!reversal) throw new Error('BANK_REVERSAL_NOT_FOUND')
    if (!reversal.approvalRequestId || reversal.approvalRequestId !== input.approvalRequestId) throw new Error('BANK_REVERSAL_APPROVAL_MISMATCH')
    if (reversal.initiatedByAdminId === input.actorAdminId) throw new Error('BANK_REVERSAL_SELF_APPROVAL')
    await assertApprovalDecision(tx, {
      approvalRequestId: input.approvalRequestId,
      bankTransactionId: input.bankTransactionId,
      actorAdminId: input.actorAdminId,
      decision: 'APPROVE',
    }, {
      status: 'APPROVED', initiatedByAdminId: reversal.initiatedByAdminId,
      countryCode: reversal.countryCode, currency: reversal.currency, amountMinor: reversal.amountMinor,
    })
    if (reversal.status === 'POSTED') return { replayed: true, reversalId: reversal.id, amountMinor: reversal.amountMinor }
    if (reversal.status !== 'PENDING_REVIEW') throw new Error('BANK_REVERSAL_NOT_POSTABLE')

    const debit = reversal.bankTransaction
    const original = reversal.originalBankTransaction
    const reconciliation = reversal.originalReconciliation
    assertTrustedBankEvidenceSource(debit.statementImport)
    assertTrustedBankEvidenceSource(original.statementImport)
    if (
      debit.direction !== 'DEBIT' || debit.reversalOfTransactionId !== original.transactionId ||
      debit.status !== 'MATCHED' ||
      original.direction !== 'CREDIT' || original.id !== reversal.originalReconciliation.bankTransactionId ||
      reconciliation.status !== 'POSTED' || reversal.amountMinor !== debit.amountMinor ||
      reversal.amountMinor !== reversal.allocations.reduce((sum, item) => sum + item.amountMinor, 0n) ||
      debit.bankAccountRef !== original.bankAccountRef || debit.sourceSystem !== original.sourceSystem ||
      debit.countryCode !== original.countryCode || debit.countryCode !== reversal.countryCode ||
      debit.currency !== original.currency || debit.currency !== reversal.currency ||
      debit.statementImport.accountRef !== debit.bankAccountRef ||
      original.statementImport.accountRef !== original.bankAccountRef ||
      debit.statementImport.countryCode !== debit.countryCode || original.statementImport.countryCode !== original.countryCode ||
      debit.statementImport.currency !== debit.currency || original.statementImport.currency !== original.currency
    ) throw new Error('BANK_REVERSAL_EVIDENCE_MISMATCH')

    const originalAllocations = await tx.commissionBankAllocation.findMany({
      where: { reconciliationId: reconciliation.id },
      select: { amountMinor: true },
    })
    if (originalAllocations.reduce((sum, item) => sum + item.amountMinor, 0n) !== reconciliation.totalAmountMinor) {
      throw new Error('BANK_REVERSAL_ALLOCATION_TOTAL_MISMATCH')
    }

    await tx.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM "CommissionBankReconciliation" WHERE id = $1 FOR UPDATE', reconciliation.id,
    )
    const reversedAllocations = await tx.commissionBankReversalAllocation.findMany({
      where: {
        originalAllocationId: { in: reversal.allocations.map(item => item.originalAllocationId) },
        reversal: { status: { in: ['PENDING_REVIEW', 'POSTED'] } },
      },
      select: { originalAllocationId: true, amountMinor: true, reversalId: true },
    })
    const reversedByOriginal = new Map<string, bigint>()
    for (const item of reversedAllocations) reversedByOriginal.set(item.originalAllocationId, (reversedByOriginal.get(item.originalAllocationId) || 0n) + item.amountMinor)
    for (const item of reversal.allocations) {
      if ((reversedByOriginal.get(item.originalAllocationId) || 0n) > item.originalAllocation.amountMinor) {
        throw new Error('BANK_REVERSAL_ALLOCATION_ALREADY_CONSUMED')
      }
      if (
        item.recovery.providerIdentityId !== reversal.providerIdentityId ||
        item.recovery.currency !== reversal.currency ||
        item.recovery.amount !== item.originalAllocation.amountMinor ||
        item.originalAllocation.reconciliationId !== reconciliation.id ||
        item.originalAllocation.receivable.providerIdentityId !== reversal.providerIdentityId ||
        item.originalAllocation.receivable.currency !== reversal.currency
      ) throw new Error('BANK_REVERSAL_ALLOCATION_DEBTOR_MISMATCH')
    }

    const identity = await tx.providerIdentity.findUnique({
      where: { id: reversal.providerIdentityId },
      select: { id: true, identityType: true, countryCode: true },
    })
    if (!identity || identity.countryCode !== reversal.countryCode || !['TASKER', 'COMPANY'].includes(identity.identityType)) {
      throw new Error('BANK_REVERSAL_DEBTOR_MARKET_MISMATCH')
    }
    const accountRows = await tx.$queryRawUnsafe<Array<{ id: string; commissionDue: string; adjustmentDue: string }>>(
      'SELECT id, "commissionDue"::text AS "commissionDue", "adjustmentDue"::text AS "adjustmentDue" FROM "ProviderFinancialAccount" WHERE "providerIdentityId" = $1 AND currency = $2 FOR UPDATE',
      identity.id, reversal.currency,
    )
    const account = accountRows[0]
    if (!account) throw new Error('PROVIDER_FINANCIAL_ACCOUNT_NOT_FOUND')
    const total = reversal.amountMinor
    const receivableSettlementIds = reversal.allocations.map(item => item.originalAllocation.receivable.weeklySettlementId)
    if (receivableSettlementIds.some(id => !id)) throw new Error('BANK_REVERSAL_SETTLEMENT_MISMATCH')
    const weeklySettlementIds = [...new Set(receivableSettlementIds.filter((id): id is string => Boolean(id)))]
    if (weeklySettlementIds.length !== 1) throw new Error('BANK_REVERSAL_SETTLEMENT_MISMATCH')

    const receivableIds = [...new Set(reversal.allocations.map(item => item.originalAllocation.receivableId))].sort()
    for (const id of receivableIds) {
      await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT id FROM "ProviderCommissionReceivable" WHERE id = $1 FOR UPDATE', id,
      )
    }
    for (const item of reversal.allocations) {
      const receivable = item.originalAllocation.receivable
      const nextRemaining = receivable.amountRemaining + item.amountMinor
      if (nextRemaining > receivable.amountOriginal) throw new Error('BANK_REVERSAL_RECEIVABLE_OVERFLOW')
      await tx.providerCommissionReceivable.update({
        where: { id: receivable.id },
        data: {
          amountRemaining: nextRemaining,
          status: nextRemaining === receivable.amountOriginal ? 'OPEN' : 'PARTIAL',
          settledAt: null,
        },
      })
    }

    await postLedgerTransaction({
      entries: [
        { accountId: `provider-receivable:${identity.id}`, accountType: 'PROVIDER_COMMISSION_RECEIVABLE', entryType: 'DEBIT', amount: total },
        { accountId: `commission-clearing:${reversal.currency}`, accountType: 'PLATFORM_CASH_CLEARING', entryType: 'CREDIT', amount: total },
      ],
      currency: reversal.currency as Currency,
      referenceType: 'COMMISSION_BANK_REVERSAL',
      referenceId: reversal.id,
      idempotencyKey: `commission-bank-reversal:${debit.id}`,
      description: `Compensating entry for reversed bank commission credit ${original.transactionId}`,
      createdBy: input.actorAdminId,
      metadata: JSON.stringify({ bankTransactionId: debit.id, originalBankTransactionId: original.id, originalReconciliationId: reconciliation.id, providerIdentityId: identity.id }),
    }, tx)

    const newCommissionDue = BigInt(account.commissionDue) + total
    const oldestDue = await tx.providerCommissionReceivable.findFirst({
      where: { providerIdentityId: identity.id, currency: reversal.currency, status: { in: ['OPEN', 'PARTIAL'] }, amountRemaining: { gt: 0n } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      select: { dueAt: true },
    })
    const policy = await resolveProviderFinancialPolicy(tx, {
      countryCode: identity.countryCode,
      providerType: identity.identityType === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL',
      currency: reversal.currency,
    })
    const standing = evaluateProviderFinancialStanding({
      commissionDueMinor: newCommissionDue + BigInt(account.adjustmentDue),
      oldestCommissionDueAt: oldestDue?.dueAt || null,
    }, policy)
    const standingStatus = BigInt(account.adjustmentDue) > 0n ? 'REVIEW_REQUIRED' : standing.standing === 'CLEAR' ? 'ACTIVE' : standing.standing
    await tx.providerFinancialAccount.update({
      where: { id: account.id },
      data: {
        commissionDue: newCommissionDue,
        oldestCommissionDueAt: oldestDue?.dueAt || null,
        status: standingStatus,
        cashJobsAllowed: BigInt(account.adjustmentDue) > 0n ? false : standing.cashJobsAllowed,
        onlineJobsAllowed: standing.onlineJobsAllowed,
        manualReviewRequired: BigInt(account.adjustmentDue) > 0n || standing.manualReviewRequired,
        lastEvaluatedAt: new Date(),
        version: { increment: 1 },
      },
    })
    await tx.providerIdentity.update({ where: { id: identity.id }, data: { standingStatus } })

    const weeklySettlementId = weeklySettlementIds[0]
    const remainingCount = await tx.providerCommissionReceivable.count({
      where: { weeklySettlementId, status: { in: ['OPEN', 'PARTIAL'] }, amountRemaining: { gt: 0n } },
    })
    if (remainingCount > 0) {
      const weeklySettlement = await tx.weeklySettlement.findUnique({
        where: { id: weeklySettlementId },
        select: { dueAt: true, status: true, notes: true },
      })
      if (!weeklySettlement) throw new Error('BANK_REVERSAL_SETTLEMENT_MISMATCH')
      await tx.weeklySettlement.update({
        where: { id: weeklySettlementId },
        data: {
          commissionPaid: false,
          paidAt: null,
          status: weeklySettlement.status === 'SUSPENDED'
            ? 'SUSPENDED'
            : weeklySettlement.dueAt < new Date() ? 'OVERDUE' : 'PENDING',
          notes: [weeklySettlement.notes?.trim(), 'Commission obligation reopened after a verified bank reversal; see append-only reversal record.']
            .filter(Boolean).join('\n'),
        },
      })
      await tx.commissionPayment.updateMany({
        where: { weeklySettlementId, status: 'CONFIRMED' },
        data: { status: 'PENDING', confirmedAt: null, confirmedById: null },
      })
    }

    await tx.commissionBankReversal.update({ where: { id: reversal.id }, data: { status: 'POSTED' } })
    await tx.commissionBankTransaction.update({ where: { id: debit.id }, data: { status: 'RECONCILED' } })
    const postedReversals = await tx.commissionBankReversal.findMany({
      where: { originalReconciliationId: reconciliation.id, status: 'POSTED' },
      select: { amountMinor: true },
    })
    const reversedTotal = postedReversals.reduce((sum, item) => sum + item.amountMinor, 0n)
    if (reversedTotal > reconciliation.totalAmountMinor) throw new Error('BANK_REVERSAL_ALLOCATION_ALREADY_CONSUMED')
    await tx.commissionBankTransaction.update({
      where: { id: original.id },
      data: { status: reversedTotal === reconciliation.totalAmountMinor ? 'REVERSED' : 'PARTIALLY_REVERSED' },
    })
    await tx.commissionBankReversalEvent.create({
      data: {
        reversalId: reversal.id,
        eventType: 'REVERSAL_POSTED',
        actorAdminId: input.actorAdminId,
        metadata: JSON.stringify({ approvalRequestId: input.approvalRequestId, amountMinor: total.toString(), originalReconciliationId: reconciliation.id }),
      },
    })
    await tx.commissionBankReconciliationEvent.create({
      data: {
        reconciliationId: reconciliation.id,
        eventType: reversedTotal === reconciliation.totalAmountMinor ? 'BANK_CREDIT_FULLY_REVERSED' : 'BANK_CREDIT_PARTIALLY_REVERSED',
        actorAdminId: input.actorAdminId,
        metadata: JSON.stringify({ reversalId: reversal.id, bankTransactionId: debit.id, amountMinor: total.toString(), cumulativeReversedMinor: reversedTotal.toString() }),
      },
    })
    if (reversedTotal === reconciliation.totalAmountMinor) {
      await tx.commissionBankReconciliation.update({
        where: { id: reconciliation.id },
        data: { status: 'REVERSED' },
      })
    }
    return { replayed: false, reversalId: reversal.id, amountMinor: total, cumulativeReversedMinor: reversedTotal }
  })
}

export async function rejectCommissionBankReversal(input: {
  bankTransactionId: string
  actorAdminId: string
  approvalRequestId: string
  reason: string
}) {
  return withSerializableRetry(async tx => {
    const reversal = await tx.commissionBankReversal.findUnique({ where: { bankTransactionId: input.bankTransactionId } })
    if (!reversal) throw new Error('BANK_REVERSAL_NOT_FOUND')
    if (!reversal.approvalRequestId || reversal.approvalRequestId !== input.approvalRequestId) throw new Error('BANK_REVERSAL_APPROVAL_MISMATCH')
    if (reversal.initiatedByAdminId === input.actorAdminId) throw new Error('BANK_REVERSAL_SELF_APPROVAL')
    await assertApprovalDecision(tx, {
      approvalRequestId: input.approvalRequestId,
      bankTransactionId: input.bankTransactionId,
      actorAdminId: input.actorAdminId,
      decision: 'REJECT',
    }, {
      status: 'REJECTED', initiatedByAdminId: reversal.initiatedByAdminId,
      countryCode: reversal.countryCode, currency: reversal.currency, amountMinor: reversal.amountMinor,
    })
    if (reversal.status === 'REJECTED') return { replayed: true, reversalId: reversal.id }
    if (reversal.status !== 'PENDING_REVIEW') throw new Error('BANK_REVERSAL_NOT_REJECTABLE')
    const updated = await tx.commissionBankReversal.updateMany({
      where: { id: reversal.id, status: 'PENDING_REVIEW', approvalRequestId: input.approvalRequestId },
      data: { status: 'REJECTED' },
    })
    if (updated.count !== 1) throw new Error('BANK_REVERSAL_STATE_CHANGED')
    await tx.commissionBankTransaction.updateMany({
      where: { id: reversal.bankTransactionId, status: 'MATCHED' },
      data: { status: 'MISMATCH', mismatchCode: 'REVERSAL_REJECTED' },
    })
    await tx.commissionBankReversalEvent.create({
      data: {
        reversalId: reversal.id,
        eventType: 'REVERSAL_REJECTED',
        actorAdminId: input.actorAdminId,
        metadata: JSON.stringify({ approvalRequestId: input.approvalRequestId, reason: input.reason.slice(0, 1000) }),
      },
    })
    return { replayed: false, reversalId: reversal.id }
  })
}
