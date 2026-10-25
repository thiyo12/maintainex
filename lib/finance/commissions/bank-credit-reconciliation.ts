import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureProviderIdentity, settleProviderReceivablesFromBankCredit } from './provider-balance-service'
import { commissionPaymentRemainingMinor, isCommissionPaymentFullyReconciled } from './bank-statement-import'

async function withSerializableRetry<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      const isSerializationConflict = Boolean(
        error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2034'
      )
      if (!isSerializationConflict || attempt === 2) throw error
    }
  }
  throw new Error('BANK_RECONCILIATION_RETRY_EXHAUSTED')
}

export function assertTrustedBankEvidenceSource(statement: {
  provenanceStatus: string
  provenanceType: string
  sourceSystem: string
  verificationSource: string | null
  verificationRef: string | null
  verifiedAt: Date | null
}) {
  if (statement.provenanceStatus !== 'VERIFIED') throw new Error('BANK_PROVENANCE_NOT_VERIFIED')
  if (!statement.verificationRef || !statement.verifiedAt || statement.verificationSource !== statement.sourceSystem) {
    throw new Error('BANK_VERIFICATION_PROVENANCE_MISMATCH')
  }
  if (statement.provenanceType === 'SIMULATED') {
    if (process.env.NODE_ENV === 'production') throw new Error('SIMULATED_BANK_EVIDENCE_DISABLED')
    return
  }
  // HMAC confirms callback authenticity only. The independently approved
  // source allowlist is the trust boundary for any live ledger posting.
  if (process.env.NODE_ENV !== 'test') {
    const trustedSources = new Set((process.env.MAINTAINEX_TRUSTED_BANK_EVIDENCE_SOURCES || '')
      .split(',').map(value => value.trim()).filter(Boolean))
    if (statement.provenanceType !== 'BANK_FEED' || !trustedSources.has(statement.sourceSystem)) {
      throw new Error('BANK_SOURCE_NOT_TRUSTED')
    }
  }
}

export async function prepareCommissionBankReconciliation(input: {
  bankTransactionId: string
  actorAdminId: string
}) {
  return withSerializableRetry(async (tx) => {
    const row = await tx.commissionBankTransaction.findUnique({
      where: { id: input.bankTransactionId },
      include: { statementImport: true, reconciliation: true },
    })
    if (!row) throw new Error('BANK_TRANSACTION_NOT_FOUND')
    if (row.reconciliation) return row.reconciliation
    assertTrustedBankEvidenceSource(row.statementImport)
    if (row.direction !== 'CREDIT') throw new Error('BANK_ENTRY_NOT_CREDIT')
    if (row.reversalOfTransactionId) throw new Error('BANK_REVERSAL_REQUIRES_REVIEW')
    if (row.status === 'RECONCILED' || row.status === 'DUPLICATE') throw new Error('BANK_TRANSACTION_ALREADY_USED')
    if (row.bankAccountRef !== row.statementImport.accountRef || row.countryCode !== row.statementImport.countryCode || row.currency !== row.statementImport.currency) {
      throw new Error('BANK_STATEMENT_ROW_MISMATCH')
    }

    const payment = await tx.commissionPayment.findUnique({
      where: { referenceNumber: row.reference },
      include: { weeklySettlement: true },
    })
    if (!payment || !['PENDING', 'CONFIRMED'].includes(payment.status)) throw new Error('BANK_REFERENCE_NOT_AN_OPEN_COMMISSION')
    const settlement = payment.weeklySettlement
    if (payment.providerId !== settlement.providerId) throw new Error('BANK_COMMISSION_DEBTOR_MISMATCH')
    const providerType = settlement.providerType === 'COMPANY' ? 'COMPANY' : settlement.providerType === 'TASKER' ? 'INDIVIDUAL' : null
    if (!providerType || settlement.countryCode !== row.countryCode || settlement.currency !== row.currency) {
      throw new Error('BANK_COMMISSION_MARKET_MISMATCH')
    }
    const identity = await ensureProviderIdentity(tx, {
      providerId: settlement.providerId,
      providerType,
      countryCode: settlement.countryCode,
    })
    if (identity.countryCode !== row.countryCode) throw new Error('BANK_COMMISSION_DEBTOR_COUNTRY_MISMATCH')
    const account = await tx.providerFinancialAccount.findUnique({
      where: { providerIdentityId_currency: { providerIdentityId: identity.id, currency: row.currency } },
      select: { commissionDue: true },
    })
    if (!account || account.commissionDue <= 0n || row.amountMinor > account.commissionDue) {
      throw new Error('BANK_COMMISSION_AMOUNT_MISMATCH')
    }
    const postedForReference = await tx.commissionBankReconciliation.aggregate({
      where: { commissionPaymentId: payment.id, status: 'POSTED' },
      _sum: { totalAmountMinor: true },
    })
    if (row.amountMinor > commissionPaymentRemainingMinor(payment.amountDue, postedForReference._sum?.totalAmountMinor || 0n)) {
      throw new Error('BANK_COMMISSION_AMOUNT_MISMATCH')
    }

    const reconciliation = await tx.commissionBankReconciliation.create({
      data: {
        bankTransactionId: row.id,
        providerIdentityId: identity.id,
        commissionPaymentId: payment.id,
        initiatedByAdminId: input.actorAdminId,
        status: 'PENDING_REVIEW',
        totalAmountMinor: row.amountMinor,
        currency: row.currency,
        countryCode: row.countryCode,
        events: {
          create: {
            eventType: 'RECONCILIATION_PROPOSED',
            actorAdminId: input.actorAdminId,
            metadata: JSON.stringify({ debtorType: identity.identityType, referenceMatched: true }),
          },
        },
      },
    })
    await tx.commissionBankTransaction.update({ where: { id: row.id }, data: { status: 'MATCHED' } })
    return reconciliation
  })
}

export async function postApprovedCommissionBankReconciliation(input: {
  bankTransactionId: string
  actorAdminId: string
  approvalRequestId: string
}) {
  return withSerializableRetry(async (tx) => {
    const reconciliation = await tx.commissionBankReconciliation.findUnique({
      where: { bankTransactionId: input.bankTransactionId },
      include: { bankTransaction: { include: { statementImport: true } } },
    })
    if (!reconciliation) throw new Error('BANK_RECONCILIATION_NOT_PREPARED')
    if (reconciliation.status === 'POSTED') return { replayed: true, reconciliationId: reconciliation.id }
    if (reconciliation.status !== 'PENDING_REVIEW') throw new Error('BANK_RECONCILIATION_NOT_POSTABLE')
    if (reconciliation.initiatedByAdminId === input.actorAdminId) throw new Error('BANK_RECONCILIATION_SELF_APPROVAL')
    assertTrustedBankEvidenceSource(reconciliation.bankTransaction.statementImport)
    if (reconciliation.bankTransaction.direction !== 'CREDIT' || reconciliation.bankTransaction.reversalOfTransactionId) {
      throw new Error('BANK_CREDIT_NOT_POSTABLE')
    }
    const payment = await tx.commissionPayment.findUnique({
      where: { referenceNumber: reconciliation.bankTransaction.reference },
      include: { weeklySettlement: true },
    })
    if (!payment || !['PENDING', 'CONFIRMED'].includes(payment.status) ||
        payment.weeklySettlement.countryCode !== reconciliation.countryCode || payment.weeklySettlement.currency !== reconciliation.currency ||
        reconciliation.totalAmountMinor !== reconciliation.bankTransaction.amountMinor ||
        reconciliation.bankTransaction.countryCode !== reconciliation.countryCode ||
        reconciliation.bankTransaction.currency !== reconciliation.currency ||
        reconciliation.bankTransaction.bankAccountRef !== reconciliation.bankTransaction.statementImport.accountRef) {
      throw new Error('BANK_REFERENCE_NOT_AN_OPEN_COMMISSION')
    }
    if (reconciliation.commissionPaymentId !== payment.id) throw new Error('BANK_COMMISSION_REFERENCE_CHANGED')
    const previousPosted = await tx.commissionBankReconciliation.aggregate({
      where: { commissionPaymentId: payment.id, status: 'POSTED', id: { not: reconciliation.id } },
      _sum: { totalAmountMinor: true },
    })
    if (reconciliation.totalAmountMinor > commissionPaymentRemainingMinor(payment.amountDue, previousPosted._sum?.totalAmountMinor || 0n)) {
      throw new Error('BANK_COMMISSION_AMOUNT_MISMATCH')
    }
    if (payment.providerId !== payment.weeklySettlement.providerId) throw new Error('BANK_COMMISSION_DEBTOR_MISMATCH')
    const settlement = payment.weeklySettlement
    const providerType = settlement.providerType === 'COMPANY' ? 'COMPANY' : settlement.providerType === 'TASKER' ? 'INDIVIDUAL' : null
    if (!providerType) throw new Error('BANK_COMMISSION_DEBTOR_INVALID')
    const currentIdentity = await ensureProviderIdentity(tx, {
      providerId: settlement.providerId,
      providerType,
      countryCode: settlement.countryCode,
    })
    if (currentIdentity.id !== reconciliation.providerIdentityId || currentIdentity.countryCode !== reconciliation.countryCode) {
      throw new Error('BANK_COMMISSION_DEBTOR_MISMATCH')
    }
    const result = await settleProviderReceivablesFromBankCredit(tx, {
      bankTransactionId: reconciliation.bankTransactionId,
      reconciliationId: reconciliation.id,
      providerIdentityId: reconciliation.providerIdentityId,
      weeklySettlementId: payment.weeklySettlementId,
      amountMinor: reconciliation.totalAmountMinor,
      currency: reconciliation.currency,
      createdBy: input.actorAdminId,
    })
    if (!('allocations' in result)) return { replayed: true, reconciliationId: reconciliation.id }
    for (const allocation of result.allocations || []) {
      await tx.commissionBankAllocation.create({
        data: {
          reconciliationId: reconciliation.id,
          receivableId: allocation.receivableId,
          amountMinor: allocation.amountMinor,
        },
      })
    }
    await tx.commissionBankReconciliation.update({
      where: { id: reconciliation.id },
      data: { status: 'POSTED', approvalRequestId: input.approvalRequestId },
    })
    await tx.commissionBankTransaction.update({
      where: { id: reconciliation.bankTransactionId },
      data: { status: 'RECONCILED' },
    })
    await tx.commissionBankReconciliationEvent.create({
      data: {
        reconciliationId: reconciliation.id,
        eventType: 'LEDGER_POSTED',
        actorAdminId: input.actorAdminId,
        metadata: JSON.stringify({ approvalRequestId: input.approvalRequestId, amountMinor: reconciliation.totalAmountMinor.toString() }),
      },
    })
    if (isCommissionPaymentFullyReconciled({
      amountDueMajor: payment.amountDue,
      previouslyPostedMinor: previousPosted._sum?.totalAmountMinor || 0n,
      currentCreditMinor: reconciliation.totalAmountMinor,
    }) && payment.status !== 'CONFIRMED') {
      await tx.commissionPayment.update({
        where: { id: payment.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: input.actorAdminId, method: 'BANK' },
      })
    }
    return { replayed: false, reconciliationId: reconciliation.id, amountMinor: reconciliation.totalAmountMinor }
  })
}

