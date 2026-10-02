import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import { recordJobLifecycleEvent } from '@/lib/domain/job-lifecycle-audit'
import { notifyEscrowDeposited } from '@/lib/notifications'
import {
  normalizePaymentProvider,
  type PaymentProviderCode,
} from '@/lib/finance/payments/provider-registry'
import type { Currency } from '@/lib/shared/money/money'

export type ProviderCaptureInput = {
  provider: string
  providerOrderId: string
  providerCaptureId: string
  amountMinor: bigint
  currency: string
  paymentIntentId?: string | null
  providerFeeMinor?: bigint | null
  netSettlementMinor?: bigint | null
  providerStatus?: string | null
}

export type ProviderCaptureResult = {
  success: boolean
  paymentIntentId?: string
  newlyProtected?: boolean
  refundRequired?: boolean
  error?: string
  code?: string
}

type CaptureIntent = {
  id: string
  jobId: string
  customerId: string
  escrowId: string
  status: string
  amount: bigint
  currency: string
  gateway: string
  merchantOrderId: string
  paymentId: string | null
}

function gatewaySnapshot(input: ProviderCaptureInput, provider: PaymentProviderCode) {
  return JSON.stringify({
    provider,
    orderId: input.providerOrderId,
    captureId: input.providerCaptureId,
    captureStatus: input.providerStatus || 'COMPLETED',
    grossAmountMinor: input.amountMinor.toString(),
    providerFeeMinor: input.providerFeeMinor?.toString() || null,
    netSettlementMinor: input.netSettlementMinor?.toString() || null,
    currency: input.currency,
    verifiedAt: new Date().toISOString(),
  })
}

async function recordProviderTransaction(
  tx: Prisma.TransactionClient,
  intent: CaptureIntent,
  input: ProviderCaptureInput,
  provider: PaymentProviderCode,
  countryCode: string,
  status: string
) {
  const existing = await tx.paymentProviderTransaction.findFirst({
    where: {
      provider,
      OR: [
        { providerCaptureId: input.providerCaptureId },
        { providerOrderId: input.providerOrderId },
      ],
    },
    select: { id: true },
  })
  if (existing) return existing.id

  const transaction = await tx.paymentProviderTransaction.create({
    data: {
      paymentIntentId: intent.id,
      jobId: intent.jobId,
      countryCode,
      provider,
      providerOrderId: input.providerOrderId,
      providerCaptureId: input.providerCaptureId,
      status,
      grossAmount: input.amountMinor,
      providerFee: input.providerFeeMinor ?? null,
      netSettlement: input.netSettlementMinor ?? null,
      currency: input.currency,
      reconciliationStatus: 'UNRECONCILED',
      metadata: JSON.stringify({
        providerStatus: input.providerStatus || null,
      }),
    },
    select: { id: true },
  })
  return transaction.id
}

async function recordCaptureForRefund(
  tx: Prisma.TransactionClient,
  intent: CaptureIntent,
  input: ProviderCaptureInput,
  provider: PaymentProviderCode,
  countryCode: string,
  reason: string
): Promise<boolean> {
  const claimed = await tx.paymentIntent.updateMany({
    where: {
      id: intent.id,
      status: { in: ['CREATED', 'PENDING', 'FAILED', 'CANCELLED', 'EXPIRED'] },
    },
    data: {
      status: 'REFUND_REQUIRED',
      paymentId: input.providerCaptureId,
      gatewayResponse: gatewaySnapshot(input, provider),
      paidAt: new Date(),
    },
  })

  if (claimed.count === 0) {
    const current = await tx.paymentIntent.findUnique({
      where: { id: intent.id },
      select: { status: true },
    })
    if (
      current?.status === 'REFUND_REQUIRED' ||
      current?.status === 'REFUND_PROCESSING' ||
      current?.status === 'REFUNDED' ||
      current?.status === 'SUCCESS'
    ) {
      return false
    }
    throw new Error('Payment intent state changed while recording provider capture')
  }

  await recordProviderTransaction(
    tx,
    intent,
    input,
    provider,
    countryCode,
    'REFUND_REQUIRED'
  )

  const externalAccount = `external:${provider.toLowerCase()}`
  await postLedgerTransaction({
    entries: [
      {
        accountId: externalAccount,
        accountType: 'EXTERNAL_PAYOUT',
        entryType: 'DEBIT',
        amount: intent.amount,
      },
      {
        accountId: `refund-suspense:${intent.id}`,
        accountType: 'REFUND_SUSPENSE',
        entryType: 'CREDIT',
        amount: intent.amount,
      },
    ],
    currency: intent.currency as Currency,
    referenceType: 'PAYMENT_REFUND_SUSPENSE',
    referenceId: intent.id,
    idempotencyKey: `${provider.toLowerCase()}-refund-suspense:${intent.id}:${input.providerCaptureId}`,
    description: `Late ${provider} capture awaiting refund for payment intent ${intent.id}`,
    createdBy: intent.customerId,
    metadata: JSON.stringify({
      jobId: intent.jobId,
      escrowId: intent.escrowId,
      provider,
      providerOrderId: input.providerOrderId,
      providerCaptureId: input.providerCaptureId,
      reason,
    }),
  }, tx)

  await tx.marketplaceRiskEvent.create({
    data: {
      jobId: intent.jobId,
      actorUserId: intent.customerId,
      eventType: 'LATE_PAYMENT_REFUND_REQUIRED',
      severity: 'CRITICAL',
      metadata: JSON.stringify({
        paymentIntentId: intent.id,
        provider,
        providerOrderId: input.providerOrderId,
        providerCaptureId: input.providerCaptureId,
        amountMinor: input.amountMinor.toString(),
        currency: input.currency,
        reason,
      }),
    },
  })

  await recordJobLifecycleEvent(tx, {
    jobId: intent.jobId,
    actorId: intent.customerId,
    actorType: 'CUSTOMER',
    action: 'PAYMENT_REFUND_REQUIRED',
    metadata: {
      paymentIntentId: intent.id,
      paymentId: input.providerCaptureId,
      provider,
      providerOrderId: input.providerOrderId,
      escrowId: intent.escrowId,
      suspenseAccountId: `refund-suspense:${intent.id}`,
      reason,
    },
  })

  return true
}

export async function finalizeProviderCapture(
  input: ProviderCaptureInput
): Promise<ProviderCaptureResult> {
  const provider = normalizePaymentProvider(input.provider)
  if (!provider || provider === 'MANUAL_BANK') {
    return {
      success: false,
      error: 'Unsupported capture provider',
      code: 'PAYMENT_PROVIDER_UNSUPPORTED',
    }
  }

  const providerOrderId = input.providerOrderId.trim()
  const providerCaptureId = input.providerCaptureId.trim()
  const currency = input.currency.trim().toUpperCase()
  if (!providerOrderId || !providerCaptureId || input.amountMinor <= 0n) {
    return {
      success: false,
      error: 'Invalid provider capture',
      code: 'PAYMENT_CAPTURE_INVALID',
    }
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: input.paymentIntentId
      ? { id: input.paymentIntentId }
      : { gateway: provider, merchantOrderId: providerOrderId },
  }) as CaptureIntent | null

  if (!intent) {
    return {
      success: false,
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.gateway !== provider || intent.merchantOrderId !== providerOrderId) {
    return {
      success: false,
      paymentIntentId: intent.id,
      error: 'Provider payment reference mismatch',
      code: 'PAYMENT_PROVIDER_REFERENCE_MISMATCH',
    }
  }
  if (intent.amount !== input.amountMinor) {
    return {
      success: false,
      paymentIntentId: intent.id,
      error: 'Payment amount mismatch',
      code: 'PAYMENT_AMOUNT_MISMATCH',
    }
  }
  if (intent.currency !== currency) {
    return {
      success: false,
      paymentIntentId: intent.id,
      error: 'Payment currency mismatch',
      code: 'PAYMENT_CURRENCY_MISMATCH',
    }
  }

  if (
    intent.status === 'SUCCESS' ||
    intent.status === 'REFUND_REQUIRED' ||
    intent.status === 'REFUND_PROCESSING' ||
    intent.status === 'REFUNDED'
  ) {
    return {
      success: true,
      paymentIntentId: intent.id,
      newlyProtected: false,
      refundRequired: intent.status !== 'SUCCESS',
    }
  }

  const escrow = await prisma.jobEscrow.findUnique({
    where: { id: intent.escrowId },
  })

  const job = await prisma.marketplaceJob.findUnique({
    where: { id: intent.jobId },
    select: { countryCode: true, title: true },
  })
  if (!job) {
    return {
      success: false,
      paymentIntentId: intent.id,
      error: 'Payment job not found',
      code: 'PAYMENT_JOB_NOT_FOUND',
    }
  }

  if (!['CREATED', 'PENDING'].includes(intent.status)) {
    await prisma.$transaction(async tx => {
      await recordCaptureForRefund(
        tx,
        intent,
        input,
        provider,
        job.countryCode,
        `Provider capture arrived after payment became ${intent.status}`
      )
    })
    return {
      success: true,
      paymentIntentId: intent.id,
      newlyProtected: false,
      refundRequired: true,
    }
  }

  if (!escrow) {
    await prisma.$transaction(async tx => {
      await recordCaptureForRefund(
        tx,
        intent,
        input,
        provider,
        job.countryCode,
        'Escrow missing at successful provider capture'
      )
    })
    return {
      success: true,
      paymentIntentId: intent.id,
      newlyProtected: false,
      refundRequired: true,
    }
  }

  if (
    escrow.jobId !== intent.jobId ||
    escrow.customerId !== intent.customerId ||
    escrow.totalAmount !== intent.amount ||
    escrow.currency !== intent.currency
  ) {
    await prisma.$transaction(async tx => {
      await recordCaptureForRefund(
        tx,
        intent,
        input,
        provider,
        job.countryCode,
        'Provider capture no longer matches escrow amount, currency, customer, or job'
      )
    })
    return {
      success: true,
      paymentIntentId: intent.id,
      newlyProtected: false,
      refundRequired: true,
    }
  }

  const totalAmount = escrow.totalAmount ?? escrow.amount
  const transition = await prisma.$transaction(async tx => {
    const lockedJobs = await tx.$queryRaw<
      { id: string; customerId: string; status: string; countryCode: string }[]
    >`
      SELECT id, "customerId", status, "countryCode"
      FROM "MarketplaceJob"
      WHERE id = ${intent.jobId}
      FOR UPDATE
    `
    const lockedJob = lockedJobs[0]

    if (
      !lockedJob ||
      lockedJob.customerId !== intent.customerId ||
      lockedJob.status !== 'QUOTE_ACCEPTED'
    ) {
      await recordCaptureForRefund(
        tx,
        intent,
        input,
        provider,
        job.countryCode,
        'Booking was no longer QUOTE_ACCEPTED when provider capture arrived'
      )
      return { success: true, newlyProtected: false, refundRequired: true }
    }

    const claimed = await tx.paymentIntent.updateMany({
      where: {
        id: intent.id,
        gateway: provider,
        merchantOrderId: providerOrderId,
        status: { in: ['CREATED', 'PENDING'] },
      },
      data: {
        status: 'SUCCESS',
        paymentId: providerCaptureId,
        gatewayResponse: gatewaySnapshot(input, provider),
        paidAt: new Date(),
      },
    })

    if (claimed.count !== 1) {
      const current = await tx.paymentIntent.findUnique({
        where: { id: intent.id },
        select: { status: true },
      })
      if (current?.status === 'SUCCESS') {
        return { success: true, newlyProtected: false, refundRequired: false }
      }
      throw new Error('Payment intent already processed')
    }

    const escrowClaimed = await tx.jobEscrow.updateMany({
      where: {
        id: escrow.id,
        jobId: intent.jobId,
        customerId: intent.customerId,
        status: 'PENDING_PAYMENT',
      },
      data: {
        status: 'PROTECTED',
        heldAt: new Date(),
      },
    })
    if (escrowClaimed.count !== 1) {
      throw new Error('Escrow is no longer awaiting payment')
    }

    await recordProviderTransaction(
      tx,
      intent,
      input,
      provider,
      lockedJob.countryCode,
      'COMPLETED'
    )

    const externalAccount = `external:${provider.toLowerCase()}`
    await postLedgerTransaction({
      entries: [
        {
          accountId: externalAccount,
          accountType: 'EXTERNAL_PAYOUT',
          entryType: 'DEBIT',
          amount: totalAmount,
        },
        {
          accountId: `escrow:${escrow.id}`,
          accountType: 'ESCROW',
          entryType: 'CREDIT',
          amount: totalAmount,
        },
      ],
      currency: escrow.currency as Currency,
      referenceType: 'ESCROW_DEPOSIT',
      referenceId: escrow.id,
      idempotencyKey: `${provider.toLowerCase()}-deposit:${escrow.id}:${providerCaptureId}`,
      description: `${provider} payment for escrow ${escrow.id}`,
      createdBy: intent.customerId,
      metadata: JSON.stringify({
        provider,
        providerOrderId,
        providerCaptureId,
        providerFeeMinor: input.providerFeeMinor?.toString() || null,
        netSettlementMinor: input.netSettlementMinor?.toString() || null,
      }),
    }, tx)

    await recordJobLifecycleEvent(tx, {
      jobId: intent.jobId,
      actorId: intent.customerId,
      actorType: 'CUSTOMER',
      action: 'PAYMENT_PROTECTED',
      fromState: 'PENDING_PAYMENT',
      toState: 'PROTECTED',
      metadata: {
        paymentIntentId: intent.id,
        paymentId: providerCaptureId,
        provider,
        providerOrderId,
        escrowId: escrow.id,
        amountMinor: totalAmount,
        currency: escrow.currency,
      },
    })

    return { success: true, newlyProtected: true, refundRequired: false }
  })

  if (transition.newlyProtected) {
    const acceptedQuote = await prisma.jobQuote.findFirst({
      where: { jobId: intent.jobId, status: 'ACCEPTED' },
      select: { providerId: true, providerType: true },
    })

    if (acceptedQuote) {
      const providerUserId =
        acceptedQuote.providerType === 'INDIVIDUAL'
          ? acceptedQuote.providerId
          : (await prisma.companyProfile.findUnique({
              where: { id: acceptedQuote.providerId },
              select: { userId: true },
            }))?.userId

      if (providerUserId) {
        await notifyEscrowDeposited(intent.jobId, providerUserId, job.title)
      }
    }
  }

  return {
    success: transition.success,
    paymentIntentId: intent.id,
    newlyProtected: transition.newlyProtected,
    refundRequired: transition.refundRequired,
  }
}
