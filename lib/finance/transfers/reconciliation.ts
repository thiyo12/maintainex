import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import type { Currency } from '@/lib/shared/money/money'

export type TransferType = 'REFUND' | 'PAYOUT'
export type TransferOutcome = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REVERSED'
export type TransferVerificationMethod = 'INDEPENDENT_API_QUERY' | 'AUTHENTICATED_STATEMENT'

export interface TransferEvidenceQuery {
  transferType: TransferType
  targetId: string
  externalEventId: string
  expectedAmount: bigint
  currency: Currency
  countryCode: 'LK' | 'CA'
}

/**
 * Implementations must query an allowlisted bank/PSP source and independently
 * authenticate its result. A typed reference, uploaded document, or HMAC by
 * itself is not a trusted result. No production source is registered yet.
 */
export interface TrustedTransferEvidenceSource {
  readonly sourceId: string
  verifyAndFetch(query: TransferEvidenceQuery): Promise<{
    externalEventId: string
    externalReference: string
    outcome: TransferOutcome
    amount: bigint
    currency: Currency
    countryCode: 'LK' | 'CA'
    verificationMethod: TransferVerificationMethod
    payloadHash: string
    verifiedAt: Date
    observedAt: Date
  } | null>
}

export type TransferReconciliationResult =
  | { ok: true; status: string; evidenceId: string; replayed: boolean }
  | { ok: false; code: string }

function expectedCurrency(countryCode: string): Currency | null {
  if (countryCode === 'LK') return 'LKR'
  if (countryCode === 'CA') return 'CAD'
  return null
}

function safeHash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value)
}

/**
 * Reconciles only evidence returned by a trusted source adapter. Database row
 * locks, a unique source-event key, and ledger idempotency make replay/concurrent
 * delivery safe. This service has no public route and defaults to no source.
 */
export async function reconcileFinancialTransfer(
  query: TransferEvidenceQuery,
  source: TrustedTransferEvidenceSource,
  actorId = `system:${source.sourceId}`,
): Promise<TransferReconciliationResult> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(source.sourceId) || !query.externalEventId || query.externalEventId.length > 200) {
    return { ok: false, code: 'INVALID_EVIDENCE_QUERY' }
  }
  if (expectedCurrency(query.countryCode) !== query.currency || query.expectedAmount <= 0n) {
    return { ok: false, code: 'MARKET_CURRENCY_MISMATCH' }
  }

  const result = await source.verifyAndFetch(query)
  if (!result) return { ok: false, code: 'EXTERNAL_RESULT_NOT_FOUND' }
  if (
    result.externalEventId !== query.externalEventId ||
    result.amount !== query.expectedAmount ||
    result.currency !== query.currency ||
    result.countryCode !== query.countryCode ||
    !result.externalReference.trim() || result.externalReference.trim().length > 200 ||
    !safeHash(result.payloadHash) ||
    !['INDEPENDENT_API_QUERY', 'AUTHENTICATED_STATEMENT'].includes(result.verificationMethod) ||
    !Number.isFinite(result.verifiedAt.getTime()) || !Number.isFinite(result.observedAt.getTime())
  ) return { ok: false, code: 'EXTERNAL_EVIDENCE_MISMATCH' }

  const replay = await prisma.financialTransferEvidence.findUnique({
    where: { sourceId_externalEventId: { sourceId: source.sourceId, externalEventId: result.externalEventId } },
  })
  if (replay) {
    if (replay.payloadHash !== result.payloadHash || replay.targetId !== query.targetId || replay.transferType !== query.transferType) {
      return { ok: false, code: 'EXTERNAL_EVENT_ID_CONFLICT' }
    }
    const status = query.transferType === 'PAYOUT'
      ? (await prisma.payout.findUnique({ where: { id: query.targetId }, select: { status: true } }))?.status
      : (await prisma.paymentProviderRefund.findUnique({ where: { id: query.targetId }, select: { status: true } }))?.status
    return status
      ? { ok: true, status, evidenceId: replay.id, replayed: true }
      : { ok: false, code: 'TRANSFER_NOT_FOUND' }
  }

  try {
    return await prisma.$transaction(async tx => {
      const now = new Date()
      let status: string

      const concurrentReplay = await tx.financialTransferEvidence.findUnique({
        where: { sourceId_externalEventId: { sourceId: source.sourceId, externalEventId: result.externalEventId } },
      })
      if (concurrentReplay) {
        if (concurrentReplay.payloadHash !== result.payloadHash || concurrentReplay.targetId !== query.targetId || concurrentReplay.transferType !== query.transferType) {
          throw new Error('EXTERNAL_EVENT_ID_CONFLICT')
        }
        const current = query.transferType === 'PAYOUT'
          ? (await tx.payout.findUnique({ where: { id: query.targetId }, select: { status: true } }))?.status
          : (await tx.paymentProviderRefund.findUnique({ where: { id: query.targetId }, select: { status: true } }))?.status
        if (!current) throw new Error('TRANSFER_NOT_FOUND')
        return { ok: true, status: current, evidenceId: concurrentReplay.id, replayed: true }
      }

      if (query.transferType === 'PAYOUT') {
        const rows = await tx.$queryRawUnsafe<Array<{
          id: string; userId: string; amount: string; currency: string; countryCode: string; status: string
        }>>(
          `SELECT id, "userId", amount::text, currency, "countryCode", status FROM "Payout" WHERE id = $1 FOR UPDATE`,
          query.targetId,
        )
        const payout = rows[0]
        if (!payout) throw new Error('TRANSFER_NOT_FOUND')
        if (payout.amount !== query.expectedAmount.toString() || payout.currency !== query.currency || payout.countryCode !== query.countryCode) {
          throw new Error('TRANSFER_TARGET_MISMATCH')
        }
        const payoutApproval = await tx.crmApprovalRequest.findFirst({
          where: {
            actionId: 'finance.payout', status: 'SUCCEEDED', targetType: 'Payout', targetId: payout.id,
            amountMinor: query.expectedAmount, currency: query.currency, market: query.countryCode,
          },
          select: { executionRef: true },
          orderBy: { updatedAt: 'desc' },
        })
        if (!payoutApproval?.executionRef?.includes('PROCESSING_AWAITING_EXTERNAL_EVIDENCE')) {
          throw new Error('TRANSFER_APPROVAL_REQUIRED')
        }
        if (!['RESERVED', 'PROCESSING', 'SUCCEEDED'].includes(payout.status)) throw new Error('INVALID_TRANSFER_STATE')
        if (result.outcome === 'SUCCEEDED' && payout.status !== 'PROCESSING') throw new Error('INVALID_TRANSFER_STATE')
        if (result.outcome === 'FAILED' && !['RESERVED', 'PROCESSING'].includes(payout.status)) throw new Error('INVALID_TRANSFER_STATE')
        if (result.outcome === 'REVERSED' && payout.status !== 'SUCCEEDED') throw new Error('INVALID_TRANSFER_STATE')

        const evidence = await tx.financialTransferEvidence.create({ data: {
          transferType: 'PAYOUT', targetId: payout.id, sourceId: source.sourceId,
          externalEventId: result.externalEventId, externalReference: result.externalReference,
          outcome: result.outcome, amount: result.amount, currency: result.currency,
          countryCode: result.countryCode, verificationMethod: result.verificationMethod,
          payloadHash: result.payloadHash, verifiedAt: result.verifiedAt, observedAt: result.observedAt,
        } })

        const amount = query.expectedAmount
        const wallet = await tx.providerWallet.findUnique({ where: { userId: payout.userId }, select: { id: true } })
        if (!wallet) throw new Error('WALLET_NOT_FOUND')
        if (result.outcome === 'PENDING') {
          status = payout.status === 'RESERVED' ? 'PROCESSING' : payout.status
          await tx.payout.update({ where: { id: payout.id }, data: { status, processedBy: actorId } })
        } else if (result.outcome === 'SUCCEEDED') {
          status = 'SUCCEEDED'
          await tx.payout.update({ where: { id: payout.id }, data: { status, clearedAt: now, processedBy: actorId } })
          await postLedgerTransaction({
            entries: [
              { accountId: `payout:${payout.id}`, accountType: 'PAYOUT_CLEARING', entryType: 'DEBIT', amount },
              { accountId: `external:${source.sourceId}`, accountType: 'EXTERNAL_PAYOUT', entryType: 'CREDIT', amount },
            ], currency: query.currency, referenceType: 'PAYOUT_EXTERNAL_SETTLED', referenceId: payout.id,
            idempotencyKey: `transfer-settled:${evidence.id}`, description: `Independently reconciled payout ${payout.id}`,
            createdBy: actorId, metadata: JSON.stringify({ evidenceId: evidence.id, sourceId: source.sourceId, externalReference: result.externalReference }),
          }, tx)
        } else if (result.outcome === 'FAILED') {
          status = 'FAILED'
          await tx.payout.update({ where: { id: payout.id }, data: { status, rejectedReason: 'Independently verified external transfer failure' } })
          await postLedgerTransaction({
            entries: [
              { accountId: `payout:${payout.id}`, accountType: 'PAYOUT_CLEARING', entryType: 'DEBIT', amount },
              { accountId: wallet.id, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount },
            ], currency: query.currency, referenceType: 'WITHDRAWAL_RELEASED', referenceId: payout.id,
            idempotencyKey: `transfer-failed:${evidence.id}`, description: `Verified payout failure ${payout.id}; reserved balance restored`,
            createdBy: actorId, metadata: JSON.stringify({ evidenceId: evidence.id, sourceId: source.sourceId }),
          }, tx)
        } else {
          status = 'REVERSED'
          await tx.payout.update({ where: { id: payout.id }, data: { status, rejectedReason: 'Independently verified payout reversal' } })
          await postLedgerTransaction({
            entries: [
              { accountId: `external:${source.sourceId}`, accountType: 'EXTERNAL_PAYOUT', entryType: 'DEBIT', amount },
              { accountId: wallet.id, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount },
            ], currency: query.currency, referenceType: 'PAYOUT_EXTERNAL_REVERSAL', referenceId: payout.id,
            idempotencyKey: `transfer-reversed:${evidence.id}`, description: `Verified payout reversal ${payout.id}; provider balance restored`,
            createdBy: actorId, metadata: JSON.stringify({ evidenceId: evidence.id, sourceId: source.sourceId, externalReference: result.externalReference }),
          }, tx)
        }
        return { ok: true, status, evidenceId: evidence.id, replayed: false }
      }

      const refundRows = await tx.$queryRawUnsafe<Array<{
        id: string; paymentIntentId: string; amount: string; currency: string; countryCode: string; status: string; approvalRequestId: string | null
      }>>(
        `SELECT id, "paymentIntentId", amount::text, currency, "countryCode", status, "approvalRequestId" FROM "PaymentProviderRefund" WHERE id = $1 FOR UPDATE`,
        query.targetId,
      )
      const refund = refundRows[0]
      if (!refund) throw new Error('TRANSFER_NOT_FOUND')
      if (refund.amount !== query.expectedAmount.toString() || refund.currency !== query.currency || refund.countryCode !== query.countryCode) {
        throw new Error('TRANSFER_TARGET_MISMATCH')
      }
      const refundApproval = refund.approvalRequestId
        ? await tx.crmApprovalRequest.findUnique({ where: { id: refund.approvalRequestId }, select: {
            actionId: true, status: true, targetType: true, targetId: true, amountMinor: true, currency: true,
            market: true, executionRef: true,
          } })
        : null
      if (
        !refundApproval || refundApproval.actionId !== 'finance.refund' || refundApproval.status !== 'SUCCEEDED' ||
        refundApproval.targetType !== 'PaymentIntent' || refundApproval.targetId !== refund.paymentIntentId ||
        refundApproval.amountMinor !== query.expectedAmount || refundApproval.currency !== query.currency ||
        refundApproval.market !== query.countryCode || !refundApproval.executionRef?.includes(`PaymentProviderRefund:${refund.id}:`)
      ) throw new Error('TRANSFER_APPROVAL_REQUIRED')
      if (!['REQUESTED', 'PROCESSING', 'PENDING', 'SUCCEEDED', 'COMPLETED'].includes(refund.status)) throw new Error('INVALID_TRANSFER_STATE')
      if (result.outcome === 'REVERSED' && !['SUCCEEDED', 'COMPLETED'].includes(refund.status)) throw new Error('INVALID_TRANSFER_STATE')
      if (result.outcome === 'SUCCEEDED' && !['REQUESTED', 'PROCESSING', 'PENDING'].includes(refund.status)) throw new Error('INVALID_TRANSFER_STATE')

      await tx.$queryRawUnsafe(`SELECT id FROM "PaymentIntent" WHERE id = $1 FOR UPDATE`, refund.paymentIntentId)
      const intent = await tx.paymentIntent.findUnique({ where: { id: refund.paymentIntentId } })
      if (!intent) throw new Error('TRANSFER_NOT_FOUND')
      const job = await tx.marketplaceJob.findUnique({ where: { id: intent.jobId }, select: { countryCode: true } })
      if (!job || job.countryCode !== query.countryCode || intent.currency !== query.currency || intent.amount !== query.expectedAmount) {
        throw new Error('TRANSFER_TARGET_MISMATCH')
      }
      const escrow = await tx.jobEscrow.findUnique({ where: { id: intent.escrowId } })
      if (escrow) await tx.$queryRawUnsafe(`SELECT id FROM "JobEscrow" WHERE id = $1 FOR UPDATE`, escrow.id)
      const suspenseAccountId = `refund-suspense:${intent.id}`
      const suspense = await tx.financialLedger.findFirst({ where: {
        referenceType: 'PAYMENT_REFUND_SUSPENSE', referenceId: intent.id,
        accountId: suspenseAccountId, accountType: 'REFUND_SUSPENSE', entryType: 'CREDIT',
      }, select: { amount: true, currency: true } })
      if (suspense && (suspense.amount !== intent.amount || suspense.currency !== intent.currency)) {
        throw new Error('REFUND_FUNDING_SOURCE_MISMATCH')
      }
      const validEscrowState = result.outcome === 'REVERSED'
        ? escrow?.status === 'REFUNDED'
        : Boolean(escrow && ['ON_HOLD', 'PROTECTED'].includes(escrow.status))
      if (!suspense && (
        !escrow || escrow.totalAmount !== intent.amount || escrow.currency !== intent.currency ||
        !validEscrowState
      )) {
        throw new Error('REFUND_FUNDING_SOURCE_MISMATCH')
      }
      if (result.outcome === 'SUCCEEDED' && intent.status !== 'REFUND_REQUIRED' && intent.status !== 'REFUND_PROCESSING') throw new Error('INVALID_TRANSFER_STATE')
      if (result.outcome === 'REVERSED' && intent.status !== 'REFUNDED') throw new Error('INVALID_TRANSFER_STATE')

      const evidence = await tx.financialTransferEvidence.create({ data: {
        transferType: 'REFUND', targetId: refund.id, sourceId: source.sourceId,
        externalEventId: result.externalEventId, externalReference: result.externalReference,
        outcome: result.outcome, amount: result.amount, currency: result.currency,
        countryCode: result.countryCode, verificationMethod: result.verificationMethod,
        payloadHash: result.payloadHash, verifiedAt: result.verifiedAt, observedAt: result.observedAt,
      } })
      const externalAccountId = `external:${source.sourceId}`

      if (result.outcome === 'PENDING') {
        status = 'PROCESSING'
        await tx.paymentProviderRefund.update({ where: { id: refund.id }, data: { status } })
      } else if (result.outcome === 'FAILED') {
        status = 'FAILED'
        await tx.paymentProviderRefund.update({ where: { id: refund.id }, data: { status, completedAt: null } })
      } else if (result.outcome === 'SUCCEEDED') {
        status = 'SUCCEEDED'
        await tx.paymentProviderRefund.update({ where: { id: refund.id }, data: { status, providerRefundId: result.externalReference, completedAt: now } })
        await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'REFUNDED', refundId: result.externalReference } })
        if (suspense) {
          if (suspense.amount !== intent.amount || suspense.currency !== intent.currency) throw new Error('REFUND_FUNDING_SOURCE_MISMATCH')
          await postLedgerTransaction({
            entries: [
              { accountId: suspenseAccountId, accountType: 'REFUND_SUSPENSE', entryType: 'DEBIT', amount: intent.amount },
              { accountId: externalAccountId, accountType: 'EXTERNAL_PAYOUT', entryType: 'CREDIT', amount: intent.amount },
            ], currency: query.currency, referenceType: 'PAYMENT_EXTERNAL_REFUND', referenceId: intent.id,
            idempotencyKey: `transfer-refund:${evidence.id}`, description: `Independently reconciled refund ${refund.id}`,
            createdBy: actorId, metadata: JSON.stringify({ evidenceId: evidence.id, sourceId: source.sourceId, externalReference: result.externalReference }),
          }, tx)
        } else {
          await tx.jobEscrow.update({ where: { id: escrow!.id }, data: { status: 'REFUNDED', refundedAt: now } })
          await postLedgerTransaction({
            entries: [
              { accountId: `escrow:${escrow!.id}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: intent.amount },
              { accountId: externalAccountId, accountType: 'EXTERNAL_PAYOUT', entryType: 'CREDIT', amount: intent.amount },
            ], currency: query.currency, referenceType: 'ESCROW_EXTERNAL_REFUND', referenceId: escrow!.id,
            idempotencyKey: `transfer-refund:${evidence.id}`, description: `Independently reconciled refund ${refund.id}`,
            createdBy: actorId, metadata: JSON.stringify({ evidenceId: evidence.id, sourceId: source.sourceId, externalReference: result.externalReference }),
          }, tx)
        }
      } else {
        status = 'REVERSED'
        await tx.paymentProviderRefund.update({ where: { id: refund.id }, data: { status, completedAt: null } })
        await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'REFUND_REQUIRED', refundId: null } })
        if (suspense) {
          await postLedgerTransaction({
            entries: [
              { accountId: externalAccountId, accountType: 'EXTERNAL_PAYOUT', entryType: 'DEBIT', amount: intent.amount },
              { accountId: suspenseAccountId, accountType: 'REFUND_SUSPENSE', entryType: 'CREDIT', amount: intent.amount },
            ], currency: query.currency, referenceType: 'PAYMENT_EXTERNAL_REFUND_REVERSAL', referenceId: intent.id,
            idempotencyKey: `transfer-refund-reversal:${evidence.id}`, description: `Independently reconciled refund reversal ${refund.id}`,
            createdBy: actorId, metadata: JSON.stringify({ evidenceId: evidence.id, sourceId: source.sourceId, externalReference: result.externalReference }),
          }, tx)
        } else {
          await tx.jobEscrow.update({ where: { id: escrow!.id }, data: { status: 'ON_HOLD', refundedAt: null } })
          await postLedgerTransaction({
            entries: [
              { accountId: externalAccountId, accountType: 'EXTERNAL_PAYOUT', entryType: 'DEBIT', amount: intent.amount },
              { accountId: `escrow:${escrow!.id}`, accountType: 'ESCROW', entryType: 'CREDIT', amount: intent.amount },
            ], currency: query.currency, referenceType: 'ESCROW_EXTERNAL_REFUND_REVERSAL', referenceId: escrow!.id,
            idempotencyKey: `transfer-refund-reversal:${evidence.id}`, description: `Independently reconciled refund reversal ${refund.id}`,
            createdBy: actorId, metadata: JSON.stringify({ evidenceId: evidence.id, sourceId: source.sourceId, externalReference: result.externalReference }),
          }, tx)
        }
      }
      return { ok: true, status, evidenceId: evidence.id, replayed: false }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'TRANSFER_NOT_FOUND') return { ok: false, code: 'TRANSFER_NOT_FOUND' }
    if (message === 'TRANSFER_TARGET_MISMATCH' || message === 'REFUND_FUNDING_SOURCE_MISMATCH') return { ok: false, code: message }
    if (message === 'INVALID_TRANSFER_STATE') return { ok: false, code: message }
    if (message === 'EXTERNAL_EVENT_ID_CONFLICT') return { ok: false, code: message }
    if (message === 'TRANSFER_APPROVAL_REQUIRED') return { ok: false, code: message }
    if (message === 'WALLET_NOT_FOUND') return { ok: false, code: message }
    if (message.includes('Unique constraint') || message.includes('duplicate key')) {
      const duplicate = await prisma.financialTransferEvidence.findUnique({
        where: { sourceId_externalEventId: { sourceId: source.sourceId, externalEventId: result.externalEventId } },
      })
      if (duplicate?.payloadHash === result.payloadHash && duplicate.targetId === query.targetId) {
        return { ok: true, status: result.outcome, evidenceId: duplicate.id, replayed: true }
      }
      return { ok: false, code: 'EXTERNAL_EVENT_ID_CONFLICT' }
    }
    throw error
  }
}

