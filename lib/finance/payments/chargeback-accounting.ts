import type { Prisma } from '@prisma/client'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import { recordPostPayoutProviderAdjustmentForEscrow } from '@/lib/finance/commissions/provider-balance-service'
import type { Currency } from '@/lib/shared/money/money'

export type FinalChargebackResult = {
  postPayout: boolean
  escrowReversed: boolean
  providerAdjustmentMinor: bigint
  platformLossMinor: bigint
}

export async function accountFinalProviderChargeback(
  tx: Prisma.TransactionClient,
  input: {
    paymentIntentId: string
    escrowId: string
    provider: string
    sourceReference: string
    amountMinor: bigint
    currency: string
    reason: string
    createdBy: string
    metadata?: Record<string, unknown> | null
  },
): Promise<FinalChargebackResult> {
  const provider = input.provider.trim().toUpperCase()
  const currency = input.currency.trim().toUpperCase()
  const sourceReference = input.sourceReference.trim()
  if (!provider || !sourceReference || input.amountMinor <= 0n) {
    throw new Error('FINAL_CHARGEBACK_INPUT_INVALID')
  }

  const escrow = await tx.jobEscrow.findUnique({
    where: { id: input.escrowId },
    select: {
      id: true,
      totalAmount: true,
      currency: true,
      status: true,
    },
  })
  if (!escrow) throw new Error('FINAL_CHARGEBACK_ESCROW_NOT_FOUND')
  if (escrow.totalAmount !== input.amountMinor || escrow.currency !== currency) {
    throw new Error('FINAL_CHARGEBACK_ESCROW_MISMATCH')
  }

  const externalAccountId = `external:${provider.toLowerCase()}`
  const ledgerIdempotencyKey =
    `final-chargeback:${provider}:${input.paymentIntentId}:${sourceReference}`

  if (escrow.status === 'RELEASED') {
    const adjustment = await recordPostPayoutProviderAdjustmentForEscrow(tx, {
      escrowId: escrow.id,
      paymentIntentId: input.paymentIntentId,
      sourceProvider: provider,
      sourceReference,
      adjustmentType: 'PAYMENT_CHARGEBACK',
      reason: input.reason,
      createdBy: input.createdBy,
      metadata: input.metadata,
    })

    const providerAdjustmentMinor = adjustment.amountMinor
    if (providerAdjustmentMinor > input.amountMinor) {
      throw new Error('FINAL_CHARGEBACK_PROVIDER_BENEFIT_EXCEEDS_PAYMENT')
    }
    const platformLossMinor = input.amountMinor - providerAdjustmentMinor

    const entries: Array<{
      accountId: string
      accountType: string
      entryType: 'DEBIT' | 'CREDIT'
      amount: bigint
    }> = []

    if (providerAdjustmentMinor > 0n) {
      // recordProviderBalanceAdjustment credited this clearing account. Debit
      // it here so the provider receivable is tied to the external reversal.
      entries.push({
        accountId: `chargeback-clearing:${provider}`,
        accountType: 'CHARGEBACK_CLEARING',
        entryType: 'DEBIT',
        amount: providerAdjustmentMinor,
      })
    }
    if (platformLossMinor > 0n) {
      entries.push({
        accountId: `platform-chargeback-loss:${provider}`,
        accountType: 'PLATFORM_CHARGEBACK_LOSS',
        entryType: 'DEBIT',
        amount: platformLossMinor,
      })
    }
    entries.push({
      accountId: externalAccountId,
      accountType: 'EXTERNAL_PAYOUT',
      entryType: 'CREDIT',
      amount: input.amountMinor,
    })

    await postLedgerTransaction({
      entries,
      currency: currency as Currency,
      referenceType: 'PAYMENT_CHARGEBACK',
      referenceId: input.paymentIntentId,
      idempotencyKey: ledgerIdempotencyKey,
      description: input.reason,
      createdBy: input.createdBy,
      metadata: JSON.stringify({
        escrowId: escrow.id,
        provider,
        sourceReference,
        postPayout: true,
        providerAdjustmentMinor: providerAdjustmentMinor.toString(),
        platformLossMinor: platformLossMinor.toString(),
        ...(input.metadata || {}),
      }),
    }, tx)

    return {
      postPayout: true,
      escrowReversed: false,
      providerAdjustmentMinor,
      platformLossMinor,
    }
  }

  if (escrow.status === 'PROTECTED' || escrow.status === 'ON_HOLD') {
    const claimed = await tx.jobEscrow.updateMany({
      where: {
        id: escrow.id,
        status: { in: ['PROTECTED', 'ON_HOLD'] },
      },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
      },
    })
    if (claimed.count !== 1) throw new Error('FINAL_CHARGEBACK_ESCROW_STATE_CHANGED')

    await postLedgerTransaction({
      entries: [
        {
          accountId: `escrow:${escrow.id}`,
          accountType: 'ESCROW',
          entryType: 'DEBIT',
          amount: input.amountMinor,
        },
        {
          accountId: externalAccountId,
          accountType: 'EXTERNAL_PAYOUT',
          entryType: 'CREDIT',
          amount: input.amountMinor,
        },
      ],
      currency: currency as Currency,
      referenceType: 'PAYMENT_CHARGEBACK',
      referenceId: input.paymentIntentId,
      idempotencyKey: ledgerIdempotencyKey,
      description: input.reason,
      createdBy: input.createdBy,
      metadata: JSON.stringify({
        escrowId: escrow.id,
        provider,
        sourceReference,
        postPayout: false,
        ...(input.metadata || {}),
      }),
    }, tx)

    return {
      postPayout: false,
      escrowReversed: true,
      providerAdjustmentMinor: 0n,
      platformLossMinor: 0n,
    }
  }

  throw new Error(`FINAL_CHARGEBACK_ESCROW_NOT_REVERSIBLE:${escrow.status}`)
}
