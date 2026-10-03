import type { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import { recordJobLifecycleEvent } from '@/lib/domain/job-lifecycle-audit'
import { notifyEscrowDeposited } from '@/lib/notifications'
import {
  createPayPalOrder,
  findPayPalApprovalUrl,
  getPayPalConfig,
  getPayPalOrder,
  getPayPalRefund,
  parsePayPalAmountToMinor,
  refundPayPalCapture,
} from '@/lib/finance/payments/paypal-adapter'
import { bigIntToSafeNumber, minorUnitsToMajorUnits, type Currency } from '@/lib/shared/money/money'
import {
  getPayHereConfig,
  parsePayHereAmount,
  requestPayHereRefund,
  retrievePayHerePayment,
  type PayHereNotification,
} from '@/lib/payment/payhere-adapter'
import {
  resolvePaymentProviderForMarket,
  PAYMENT_PROVIDER_NOT_AVAILABLE,
  type ResolvedPaymentProvider,
} from '@/lib/finance/payments/provider-registry'

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUND_REQUIRED'
  | 'REFUND_PROCESSING'
  | 'REFUNDED'
  | 'CHARGEDBACK'

export interface CreatePaymentParams {
  jobId: string
  customerId: string
  baseUrl: string
}

export interface PaymentResult {
  success: boolean
  paymentIntentId?: string
  checkoutUrl?: string
  merchantOrderId?: string
  gateway?: string
  error?: string
  code?: string
}

export async function createPaymentIntent(params: CreatePaymentParams): Promise<PaymentResult> {
  const { jobId, customerId, baseUrl } = params

  const previewJob = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      customerId: true,
      countryCode: true,
      status: true,
      title: true,
    },
  })
  if (!previewJob) {
    return { success: false, error: 'Job not found', code: 'JOB_NOT_FOUND' }
  }
  if (previewJob.customerId !== customerId) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }
  }

  const previewEscrow = await prisma.jobEscrow.findFirst({
    where: { jobId },
    select: { currency: true },
  })
  if (!previewEscrow) {
    return {
      success: false,
      error: 'Escrow not initialized',
      code: 'ESCROW_NOT_INITIALIZED',
    }
  }

  const provider = await resolvePaymentProviderForMarket({
    countryCode: previewJob.countryCode,
    currency: previewEscrow.currency,
  })
  if (!provider) {
    return {
      success: false,
      error: 'No verified online payment provider is available for this market and currency',
      code: PAYMENT_PROVIDER_NOT_AVAILABLE,
    }
  }

  // Defense in depth: registry policy already excludes legacy providers, but
  // payment creation itself also fails closed if that policy ever regresses.
  if (provider.provider !== 'PAYPAL') {
    return {
      success: false,
      error: `${provider.provider} is not enabled for new online checkout`,
      code: PAYMENT_PROVIDER_NOT_AVAILABLE,
    }
  }

  const providerConfigError = validateProviderRuntimeConfig(provider)
  if (providerConfigError) return providerConfigError

  type IntentDecision = {
    intent: {
      id: string
      merchantOrderId: string
      amount: bigint
      currency: string
      gateway: string
    } | null
    jobTitle: string | null
    failure: PaymentResult | null
  }

  const decision: IntentDecision = await prisma.$transaction(async tx => {
    const lockedJobs = await tx.$queryRaw<
      {
        id: string
        customerId: string
        status: string
        title: string
        countryCode: string
      }[]
    >`
      SELECT id, "customerId", status, title, "countryCode"
      FROM "MarketplaceJob"
      WHERE id = ${jobId}
      FOR UPDATE
    `
    const job = lockedJobs[0]
    if (!job) {
      return {
        intent: null,
        jobTitle: null,
        failure: { success: false, error: 'Job not found', code: 'JOB_NOT_FOUND' },
      }
    }
    if (job.customerId !== customerId) {
      return {
        intent: null,
        jobTitle: job.title,
        failure: { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      }
    }
    if (job.status !== 'QUOTE_ACCEPTED') {
      return {
        intent: null,
        jobTitle: job.title,
        failure: { success: false, error: 'Job is not payable', code: 'JOB_NOT_PAYABLE' },
      }
    }
    if (job.countryCode !== provider.countryCode) {
      return {
        intent: null,
        jobTitle: job.title,
        failure: {
          success: false,
          error: 'Payment market changed while checkout was starting',
          code: 'PAYMENT_MARKET_CHANGED',
        },
      }
    }

    const escrow = await tx.jobEscrow.findFirst({ where: { jobId } })
    if (!escrow) {
      return {
        intent: null,
        jobTitle: job.title,
        failure: {
          success: false,
          error: 'Escrow not initialized',
          code: 'ESCROW_NOT_INITIALIZED',
        },
      }
    }
    if (escrow.status !== 'PENDING_PAYMENT') {
      return {
        intent: null,
        jobTitle: job.title,
        failure: {
          success: false,
          error: 'Escrow is not awaiting payment',
          code: 'ESCROW_NOT_FUNDABLE',
        },
      }
    }
    if (escrow.currency !== provider.currency) {
      return {
        intent: null,
        jobTitle: job.title,
        failure: {
          success: false,
          error: 'Payment currency changed while checkout was starting',
          code: 'PAYMENT_CURRENCY_CHANGED',
        },
      }
    }

    const expiryCutoff = new Date(Date.now() - 30 * 60 * 1000)
    await tx.paymentIntent.updateMany({
      where: {
        jobId,
        status: { in: ['CREATED', 'PENDING'] },
        createdAt: { lt: expiryCutoff },
      },
      data: { status: 'EXPIRED' },
    })

    // Only one provider owns a fresh checkout attempt. Stale pending attempts
    // from another provider are expired before a new provider intent is issued.
    await tx.paymentIntent.updateMany({
      where: {
        jobId,
        gateway: { not: provider.provider },
        status: { in: ['CREATED', 'PENDING'] },
      },
      data: { status: 'EXPIRED' },
    })

    const existingPending = await tx.paymentIntent.findFirst({
      where: {
        jobId,
        gateway: provider.provider,
        status: { in: ['CREATED', 'PENDING'] },
      },
      select: {
        id: true,
        merchantOrderId: true,
        amount: true,
        currency: true,
        gateway: true,
      },
    })
    if (existingPending) {
      return { intent: existingPending, jobTitle: job.title, failure: null }
    }

    const totalAmount = escrow.totalAmount ?? escrow.amount
    const merchantOrderId = `PP-PENDING-${crypto.randomUUID()}`

    const paymentIntent = await tx.paymentIntent.create({
      data: {
        jobId,
        customerId,
        escrowId: escrow.id,
        merchantOrderId,
        gateway: provider.provider,
        amount: totalAmount,
        currency: escrow.currency,
        status: 'CREATED',
      },
      select: {
        id: true,
        merchantOrderId: true,
        amount: true,
        currency: true,
        gateway: true,
      },
    })

    return { intent: paymentIntent, jobTitle: job.title, failure: null }
  })

  if (decision.failure) return decision.failure
  if (!decision.intent) {
    return {
      success: false,
      error: 'Could not create payment session',
      code: 'PAYMENT_INTENT_FAILED',
    }
  }

  if (provider.provider !== 'PAYPAL') {
    return {
      success: false,
      paymentIntentId: decision.intent.id,
      error: 'Selected payment provider does not support hosted checkout',
      code: 'PAYMENT_PROVIDER_CHECKOUT_UNSUPPORTED',
    }
  }

  const intent = decision.intent
  if (!intent.merchantOrderId.startsWith('PP-PENDING-')) {
    const existingOrder = await getPayPalOrder(intent.merchantOrderId)
    const approvalUrl = findPayPalApprovalUrl(existingOrder.body || null)

    if (existingOrder.ok && approvalUrl) {
      return {
        success: true,
        paymentIntentId: intent.id,
        checkoutUrl: approvalUrl,
        merchantOrderId: intent.merchantOrderId,
        gateway: provider.provider,
      }
    }

    if (existingOrder.ok && existingOrder.orderStatus === 'COMPLETED') {
      return {
        success: false,
        paymentIntentId: intent.id,
        merchantOrderId: intent.merchantOrderId,
        error: 'PayPal order is already completed and awaiting local reconciliation',
        code: 'PAYMENT_RECONCILIATION_REQUIRED',
      }
    }
  }

  const origin = new URL(baseUrl).origin
  const created = await createPayPalOrder({
    paymentIntentId: intent.id,
    jobId,
    description: decision.jobTitle || 'MaintainEX service booking',
    amountMinor: intent.amount,
    currency: intent.currency,
    returnUrl: `${origin}/api/payments/paypal/return?paymentIntentId=${encodeURIComponent(intent.id)}`,
    cancelUrl: `${origin}/api/payments/paypal/cancel?paymentIntentId=${encodeURIComponent(intent.id)}`,
  })

  if (!created.ok || !created.orderId || !created.approvalUrl) {
    await prisma.paymentIntent.updateMany({
      where: {
        id: intent.id,
        gateway: 'PAYPAL',
        merchantOrderId: intent.merchantOrderId,
        status: 'CREATED',
      },
      data: {
        status: 'FAILED',
        gatewayResponse: JSON.stringify({
          provider: 'PAYPAL',
          phase: 'CREATE_ORDER',
          httpStatus: created.status,
          error: created.error || 'PayPal order creation failed',
        }),
      },
    })

    return {
      success: false,
      paymentIntentId: intent.id,
      error: created.error || 'Unable to create PayPal checkout',
      code: 'PAYPAL_ORDER_CREATE_FAILED',
    }
  }

  const claimed = await prisma.paymentIntent.updateMany({
    where: {
      id: intent.id,
      gateway: 'PAYPAL',
      merchantOrderId: intent.merchantOrderId,
      status: 'CREATED',
    },
    data: {
      merchantOrderId: created.orderId,
      status: 'PENDING',
      gatewayResponse: JSON.stringify({
        provider: 'PAYPAL',
        orderStatus: created.orderStatus || 'CREATED',
        createdAt: new Date().toISOString(),
      }),
    },
  })

  if (claimed.count !== 1) {
    const current = await prisma.paymentIntent.findUnique({
      where: { id: intent.id },
      select: { merchantOrderId: true, status: true, gateway: true },
    })
    if (
      current?.gateway === 'PAYPAL' &&
      current.status === 'PENDING' &&
      current.merchantOrderId === created.orderId
    ) {
      return {
        success: true,
        paymentIntentId: intent.id,
        checkoutUrl: created.approvalUrl,
        merchantOrderId: created.orderId,
        gateway: provider.provider,
      }
    }
    return {
      success: false,
      paymentIntentId: intent.id,
      error: 'Payment session changed concurrently',
      code: 'PAYMENT_SESSION_CHANGED',
    }
  }

  return {
    success: true,
    paymentIntentId: intent.id,
    checkoutUrl: created.approvalUrl,
    merchantOrderId: created.orderId,
    gateway: provider.provider,
  }
}

function validateProviderRuntimeConfig(
  provider: ResolvedPaymentProvider
): PaymentResult | null {
  if (provider.provider === 'PAYPAL') {
    const config = getPayPalConfig()
    if (!config) {
      return {
        success: false,
        error: 'PayPal payment gateway is not configured',
        code: 'PAYPAL_NOT_CONFIGURED',
      }
    }
    const runtimeEnvironment = config.sandbox ? 'SANDBOX' : 'LIVE'
    if (runtimeEnvironment !== provider.environment) {
      return {
        success: false,
        error: 'PayPal market configuration does not match runtime environment',
        code: 'PAYPAL_ENVIRONMENT_MISMATCH',
      }
    }
    return null
  }

  return {
    success: false,
    error: 'Selected payment provider does not support hosted checkout',
    code: 'PAYMENT_PROVIDER_CHECKOUT_UNSUPPORTED',
  }
}

export async function getPaymentStatus(jobId: string, customerId: string) {
  const payment = await prisma.paymentIntent.findFirst({
    where: { jobId, customerId },
    orderBy: { createdAt: 'desc' },
  })

  if (!payment) return null

  return {
    id: payment.id,
    status: payment.status,
    amount: minorUnitsToMajorUnits(payment.amount, payment.currency as Currency),
    amountMinor: payment.amount.toString(),
    currency: payment.currency,
    merchantOrderId: payment.merchantOrderId,
    paymentId: payment.paymentId,
    gateway: payment.gateway,
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() || null,
  }
}

type RefundRequiredPaymentIntent = {
  id: string
  jobId: string
  customerId: string
  escrowId: string
  status: string
  amount: bigint
  currency: string
}

async function recordCapturedPaymentForRefund(
  tx: Prisma.TransactionClient,
  paymentIntent: RefundRequiredPaymentIntent,
  notification: PayHereNotification,
  reason: string
): Promise<boolean> {
  const claimed = await tx.paymentIntent.updateMany({
    where: {
      id: paymentIntent.id,
      status: { in: ['CREATED', 'PENDING', 'FAILED', 'CANCELLED', 'EXPIRED'] },
    },
    data: {
      status: 'REFUND_REQUIRED',
      paymentId: notification.payment_id || null,
      gatewayResponse: JSON.stringify(notification),
      paidAt: new Date(),
    },
  })

  if (claimed.count === 0) {
    const current = await tx.paymentIntent.findUnique({
      where: { id: paymentIntent.id },
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
    throw new Error('Payment intent state changed while recording late payment')
  }

  await postLedgerTransaction({
    entries: [
      {
        accountId: 'external:payhere',
        accountType: 'EXTERNAL_PAYOUT',
        entryType: 'DEBIT',
        amount: paymentIntent.amount,
      },
      {
        accountId: `refund-suspense:${paymentIntent.id}`,
        accountType: 'REFUND_SUSPENSE',
        entryType: 'CREDIT',
        amount: paymentIntent.amount,
      },
    ],
    currency: paymentIntent.currency as Currency,
    referenceType: 'PAYMENT_REFUND_SUSPENSE',
    referenceId: paymentIntent.id,
    idempotencyKey: `payhere-refund-suspense:${paymentIntent.id}:${notification.payment_id || notification.order_id}`,
    description: `Late PayHere capture awaiting refund for payment intent ${paymentIntent.id}`,
    createdBy: paymentIntent.customerId,
    metadata: JSON.stringify({
      jobId: paymentIntent.jobId,
      escrowId: paymentIntent.escrowId,
      paymentId: notification.payment_id || null,
      orderId: notification.order_id,
      reason,
    }),
  }, tx)

  await tx.marketplaceRiskEvent.create({
    data: {
      jobId: paymentIntent.jobId,
      actorUserId: paymentIntent.customerId,
      eventType: 'LATE_PAYMENT_REFUND_REQUIRED',
      severity: 'CRITICAL',
      metadata: JSON.stringify({
        paymentIntentId: paymentIntent.id,
        paymentId: notification.payment_id || null,
        orderId: notification.order_id,
        amount: notification.payhere_amount,
        currency: notification.payhere_currency,
        reason,
      }),
    },
  })

  await recordJobLifecycleEvent(tx, {
    jobId: paymentIntent.jobId,
    actorId: paymentIntent.customerId,
    actorType: 'CUSTOMER',
    action: 'PAYMENT_REFUND_REQUIRED',
    metadata: {
      paymentIntentId: paymentIntent.id,
      paymentId: notification.payment_id || null,
      suspenseAccountId: `refund-suspense:${paymentIntent.id}`,
      reason,
    },
  })

  return true
}

async function markCapturedPaymentForRefund(
  paymentIntent: RefundRequiredPaymentIntent,
  notification: PayHereNotification,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  await prisma.$transaction(async tx => {
    await recordCapturedPaymentForRefund(tx, paymentIntent, notification, reason)
  })
  return { success: true }
}

export async function processPaymentSuccess(notification: PayHereNotification): Promise<{ success: boolean; error?: string }> {
  const config = getPayHereConfig()
  if (!config) return { success: false, error: 'Payment gateway not configured' }

  const paymentIntent = await prisma.paymentIntent.findFirst({
    where: { merchantOrderId: notification.order_id },
  })
  if (!paymentIntent) return { success: false, error: 'Payment intent not found' }

  const notifiedAmount = parsePayHereAmount(notification.payhere_amount)
  if (notifiedAmount === null || notifiedAmount !== paymentIntent.amount) {
    return { success: false, error: 'Payment amount mismatch' }
  }
  if (notification.payhere_currency !== paymentIntent.currency) {
    return { success: false, error: 'Payment currency mismatch' }
  }
  if (notification.custom_1 && notification.custom_1 !== paymentIntent.jobId) {
    return { success: false, error: 'Payment job reference mismatch' }
  }

  if (
    paymentIntent.status === 'SUCCESS' ||
    paymentIntent.status === 'REFUND_REQUIRED' ||
    paymentIntent.status === 'REFUND_PROCESSING' ||
    paymentIntent.status === 'REFUNDED'
  ) {
    return { success: true }
  }

  if (!['CREATED', 'PENDING'].includes(paymentIntent.status)) {
    return markCapturedPaymentForRefund(
      paymentIntent,
      notification,
      `Success callback arrived after payment became ${paymentIntent.status}`
    )
  }

  const escrow = await prisma.jobEscrow.findUnique({ where: { id: paymentIntent.escrowId } })
  if (!escrow) {
    return markCapturedPaymentForRefund(paymentIntent, notification, 'Escrow missing at successful capture')
  }

  if (
    escrow.jobId !== paymentIntent.jobId ||
    escrow.customerId !== paymentIntent.customerId ||
    escrow.totalAmount !== paymentIntent.amount ||
    escrow.currency !== paymentIntent.currency
  ) {
    return markCapturedPaymentForRefund(
      paymentIntent,
      notification,
      'Captured payment no longer matches escrow amount, currency, customer, or job'
    )
  }

  const escrowCurrency = escrow.currency as Currency
  const totalAmount = escrow.totalAmount ?? escrow.amount

  const transition = await prisma.$transaction(async (tx) => {
    const lockedJobs = await tx.$queryRaw<{ id: string; customerId: string; status: string }[]>`
      SELECT id, "customerId", status
      FROM "MarketplaceJob"
      WHERE id = ${paymentIntent.jobId}
      FOR UPDATE
    `
    const lockedJob = lockedJobs[0]

    if (
      !lockedJob ||
      lockedJob.customerId !== paymentIntent.customerId ||
      lockedJob.status !== 'QUOTE_ACCEPTED'
    ) {
      await recordCapturedPaymentForRefund(
        tx,
        paymentIntent,
        notification,
        'Booking was no longer QUOTE_ACCEPTED when successful payment arrived'
      )
      return { success: true, newlyProtected: false }
    }

    const claimed = await tx.paymentIntent.updateMany({
      where: { id: paymentIntent.id, status: { in: ['CREATED', 'PENDING'] } },
      data: {
        status: 'SUCCESS',
        paymentId: notification.payment_id || null,
        gatewayResponse: JSON.stringify(notification),
        paidAt: new Date(),
      },
    })
    if (claimed.count !== 1) throw new Error('Payment intent already processed')

    const escrowClaimed = await tx.jobEscrow.updateMany({
      where: {
        id: escrow.id,
        jobId: paymentIntent.jobId,
        customerId: paymentIntent.customerId,
        status: 'PENDING_PAYMENT',
      },
      data: { status: 'PROTECTED', heldAt: new Date() },
    })
    if (escrowClaimed.count !== 1) {
      throw new Error('Escrow is no longer awaiting payment')
    }

    await postLedgerTransaction({
      entries: [
        { accountId: `external:payhere`, accountType: 'EXTERNAL_PAYOUT', entryType: 'DEBIT', amount: totalAmount },
        { accountId: `escrow:${escrow.id}`, accountType: 'ESCROW', entryType: 'CREDIT', amount: totalAmount },
      ],
      currency: escrowCurrency,
      referenceType: 'ESCROW_DEPOSIT',
      referenceId: escrow.id,
      idempotencyKey: `payhere-deposit:${escrow.id}:${notification.payment_id || notification.order_id}`,
      description: `PayHere payment for escrow ${escrow.id}`,
      createdBy: paymentIntent.customerId,
    }, tx)

    await recordJobLifecycleEvent(tx, {
      jobId: paymentIntent.jobId,
      actorId: paymentIntent.customerId,
      actorType: 'CUSTOMER',
      action: 'PAYMENT_PROTECTED',
      fromState: 'PENDING_PAYMENT',
      toState: 'PROTECTED',
      metadata: {
        paymentIntentId: paymentIntent.id,
        paymentId: notification.payment_id || null,
        escrowId: escrow.id,
        amountMinor: totalAmount,
        currency: escrowCurrency,
      },
    })

    return { success: true, newlyProtected: true }
  })

  if (transition.newlyProtected) {
    const [job, acceptedQuote] = await Promise.all([
      prisma.marketplaceJob.findUnique({
        where: { id: paymentIntent.jobId },
        select: { title: true },
      }),
      prisma.jobQuote.findFirst({
        where: { jobId: paymentIntent.jobId, status: 'ACCEPTED' },
        select: { providerId: true, providerType: true },
      }),
    ])

    if (job && acceptedQuote) {
      const providerUserId =
        acceptedQuote.providerType === 'INDIVIDUAL'
          ? acceptedQuote.providerId
          : (await prisma.companyProfile.findUnique({
              where: { id: acceptedQuote.providerId },
              select: { userId: true },
            }))?.userId

      if (providerUserId) {
        await notifyEscrowDeposited(paymentIntent.jobId, providerUserId, job.title)
      }
    }
  }

  return { success: transition.success }
}

export async function processPaymentFailure(notification: PayHereNotification): Promise<{ success: boolean; error?: string }> {
  const paymentIntent = await prisma.paymentIntent.findFirst({
    where: { merchantOrderId: notification.order_id },
  })
  if (!paymentIntent) return { success: false, error: 'Payment intent not found' }

  const notifiedAmount = parsePayHereAmount(notification.payhere_amount)
  if (notifiedAmount === null || notifiedAmount !== paymentIntent.amount) {
    return { success: false, error: 'Payment amount mismatch' }
  }
  if (notification.payhere_currency !== paymentIntent.currency) {
    return { success: false, error: 'Payment currency mismatch' }
  }
  if (notification.custom_1 && notification.custom_1 !== paymentIntent.jobId) {
    return { success: false, error: 'Payment job reference mismatch' }
  }

  const statusCode = Number.parseInt(notification.status_code, 10)

  if (statusCode === 0) {
    await prisma.paymentIntent.updateMany({
      where: { id: paymentIntent.id, status: { in: ['CREATED', 'PENDING'] } },
      data: {
        status: 'PENDING',
        paymentId: notification.payment_id || null,
        gatewayResponse: JSON.stringify(notification),
      },
    })
    return { success: true }
  }

  if (statusCode === -3) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentIntent.updateMany({
        where: { id: paymentIntent.id, status: { not: 'CHARGEDBACK' } },
        data: {
          status: 'CHARGEDBACK',
          paymentId: notification.payment_id || paymentIntent.paymentId,
          gatewayResponse: JSON.stringify(notification),
        },
      })

      if (claimed.count !== 1) return

      await tx.jobEscrow.updateMany({
        where: { id: paymentIntent.escrowId, status: 'PROTECTED' },
        data: { status: 'ON_HOLD' },
      })

      await tx.marketplaceRiskEvent.create({
        data: {
          jobId: paymentIntent.jobId,
          actorUserId: paymentIntent.customerId,
          eventType: 'PAYMENT_CHARGEBACK',
          severity: 'CRITICAL',
          metadata: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            paymentId: notification.payment_id || paymentIntent.paymentId,
            orderId: notification.order_id,
            statusMessage: notification.status_message || null,
          }),
        },
      })

      await recordJobLifecycleEvent(tx, {
        jobId: paymentIntent.jobId,
        actorId: paymentIntent.customerId,
        actorType: 'CUSTOMER',
        action: 'PAYMENT_CHARGEDBACK',
        fromState: paymentIntent.status,
        toState: 'CHARGEDBACK',
        metadata: {
          paymentIntentId: paymentIntent.id,
          paymentId: notification.payment_id || paymentIntent.paymentId,
          escrowId: paymentIntent.escrowId,
        },
      })
    })
    return { success: true }
  }

  if (
    paymentIntent.status === 'SUCCESS' ||
    paymentIntent.status === 'REFUND_REQUIRED' ||
    paymentIntent.status === 'REFUND_PROCESSING' ||
    paymentIntent.status === 'REFUNDED'
  ) {
    return { success: true }
  }

  const status = statusCode === -1 ? 'CANCELLED' : statusCode === -2 ? 'FAILED' : null
  if (!status) return { success: false, error: `Unsupported PayHere status code: ${notification.status_code}` }

  await prisma.paymentIntent.updateMany({
    where: { id: paymentIntent.id, status: { in: ['CREATED', 'PENDING'] } },
    data: {
      status,
      paymentId: notification.payment_id || null,
      gatewayResponse: JSON.stringify(notification),
    },
  })

  return { success: true }
}

export async function expireOldPayments(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000)
  const result = await prisma.paymentIntent.updateMany({
    where: { status: { in: ['CREATED', 'PENDING'] }, createdAt: { lt: cutoff } },
    data: { status: 'EXPIRED' },
  })
  return result.count
}

function mergeGatewayResponse(
  raw: string | null,
  key: string,
  value: Record<string, unknown>
): string {
  let current: Record<string, unknown> = {}
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      current = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : { original: parsed }
    } catch {
      current = { originalRaw: raw.slice(0, 5000) }
    }
  }
  return JSON.stringify({ ...current, [key]: value })
}

function normalizePayHereStatus(value: string | undefined): string {
  return (value || '').trim().toUpperCase()
}

const PAYHERE_REFUNDABLE_CARD_METHODS = new Set([
  'VISA',
  'MASTERCARD',
  'MASTER',
  'AMEX',
  'AMERICAN EXPRESS',
  'DISCOVER',
  'DINERS CLUB',
  'DINERS',
])

function isPayHereRefundableMethod(method: string | undefined): boolean {
  return PAYHERE_REFUNDABLE_CARD_METHODS.has((method || '').trim().toUpperCase())
}

export interface PayHereRefundProcessingResult {
  success: boolean
  status: 'REFUND_REQUIRED' | 'REFUND_PROCESSING' | 'REFUNDED' | 'CHARGEDBACK'
  error?: string
  code?: string
  refundReference?: string | null
}

export async function requestRequiredPayHereRefund(
  paymentIntentId: string
): Promise<PayHereRefundProcessingResult> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
  })
  if (!intent) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }

  if (intent.status === 'REFUNDED') {
    return { success: true, status: 'REFUNDED' }
  }
  if (intent.status === 'REFUND_PROCESSING') {
    return reconcilePayHereRefund(paymentIntentId)
  }
  if (intent.status !== 'REFUND_REQUIRED') {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: `Payment is not awaiting refund (status=${intent.status})`,
      code: 'PAYMENT_NOT_REFUNDABLE',
    }
  }
  if (!intent.paymentId) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'PayHere payment ID is missing',
      code: 'PAYHERE_PAYMENT_ID_MISSING',
    }
  }

  const existing = await retrievePayHerePayment(intent.merchantOrderId)
  if (existing.status !== 1) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: existing.message,
      code: 'PAYHERE_RETRIEVAL_FAILED',
    }
  }

  const payment = existing.payments.find(
    item => String(item.payment_id) === String(intent.paymentId)
  )
  if (!payment) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Captured PayHere payment was not found during refund reconciliation',
      code: 'PAYHERE_PAYMENT_NOT_FOUND',
    }
  }

  const gatewayStatus = normalizePayHereStatus(payment.status)
  if (gatewayStatus === 'REFUNDED') {
    return finalizePayHereRefund(paymentIntentId, {
      gatewayStatus,
      refundReference: null,
      message: existing.message,
    })
  }
  if (gatewayStatus === 'REFUND REQUESTED' || gatewayStatus === 'REFUND PROCESSING') {
    await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: 'REFUND_REQUIRED' },
      data: {
        status: 'REFUND_PROCESSING',
        gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
          gatewayStatus,
          reconciledAt: new Date().toISOString(),
        }),
      },
    })
    return { success: true, status: 'REFUND_PROCESSING' }
  }
  if (gatewayStatus === 'CHARGEBACKED') {
    await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: { in: ['REFUND_REQUIRED', 'REFUND_PROCESSING'] } },
      data: {
        status: 'CHARGEDBACK',
        gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
          gatewayStatus,
          reconciledAt: new Date().toISOString(),
        }),
      },
    })
    return {
      success: false,
      status: 'CHARGEDBACK',
      error: 'Payment was chargebacked before refund completion',
      code: 'PAYHERE_CHARGEBACKED',
    }
  }
  if (gatewayStatus !== 'RECEIVED') {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: `PayHere payment cannot be refunded from status ${gatewayStatus || 'UNKNOWN'}`,
      code: 'PAYHERE_REFUND_INVALID_STATUS',
    }
  }

  const paymentMethod = payment.payment_method?.method
  if (!isPayHereRefundableMethod(paymentMethod)) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: paymentMethod
        ? `PayHere method ${paymentMethod} requires a manual customer refund`
        : 'PayHere payment method could not be verified for automated refund',
      code: paymentMethod
        ? 'PAYHERE_MANUAL_REFUND_REQUIRED'
        : 'PAYHERE_PAYMENT_METHOD_UNKNOWN',
    }
  }

  // Claim the refund before the external API call. Without this CAS, two
  // cron workers can both observe REFUND_REQUIRED and submit the same PayHere
  // refund concurrently.
  const requestClaimed = await prisma.paymentIntent.updateMany({
    where: {
      id: intent.id,
      status: 'REFUND_REQUIRED',
    },
    data: {
      status: 'REFUND_PROCESSING',
      gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
        gatewayStatus: 'REFUND REQUEST CLAIMED',
        claimedAt: new Date().toISOString(),
      }),
    },
  })

  if (requestClaimed.count !== 1) {
    const current = await prisma.paymentIntent.findUnique({
      where: { id: intent.id },
      select: { status: true },
    })
    if (current?.status === 'REFUNDED') {
      return { success: true, status: 'REFUNDED' }
    }
    if (current?.status === 'REFUND_PROCESSING') {
      return reconcilePayHereRefund(paymentIntentId)
    }
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Refund request state changed concurrently',
      code: 'PAYHERE_REFUND_STATE_CHANGED',
    }
  }

  const refund = await requestPayHereRefund(
    String(intent.paymentId),
    `MaintainEX refund for order ${intent.merchantOrderId}`
  )
  if (refund.status !== 1) {
    await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: 'REFUND_PROCESSING' },
      data: {
        status: 'REFUND_REQUIRED',
        gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
          gatewayStatus: 'REFUND REQUEST FAILED',
          message: refund.message,
          refundReference: refund.refundReference,
          failedAt: new Date().toISOString(),
        }),
      },
    })
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: refund.message,
      code: 'PAYHERE_REFUND_REQUEST_FAILED',
      refundReference: refund.refundReference,
    }
  }

  await prisma.$transaction(async tx => {
    await tx.paymentIntent.updateMany({
      where: { id: intent.id, status: 'REFUND_PROCESSING' },
      data: {
        gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
          gatewayStatus: 'REFUND REQUESTED',
          refundReference: refund.refundReference,
          message: refund.message,
          requestedAt: new Date().toISOString(),
        }),
      },
    })

    await recordJobLifecycleEvent(tx, {
      jobId: intent.jobId,
      actorId: 'system:payhere-refund',
      actorType: 'SYSTEM',
      action: 'PAYMENT_REFUND_SUBMITTED',
      metadata: {
        paymentIntentId: intent.id,
        paymentId: intent.paymentId,
        refundReference: refund.refundReference,
      },
    })
  })

  return {
    success: true,
    status: 'REFUND_PROCESSING',
    refundReference: refund.refundReference,
  }
}

export async function reconcilePayHereRefund(
  paymentIntentId: string
): Promise<PayHereRefundProcessingResult> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
  })
  if (!intent) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.status === 'REFUNDED') {
    return { success: true, status: 'REFUNDED' }
  }
  if (!['REFUND_REQUIRED', 'REFUND_PROCESSING'].includes(intent.status)) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: `Payment is not in the refund queue (status=${intent.status})`,
      code: 'PAYMENT_NOT_IN_REFUND_QUEUE',
    }
  }
  if (!intent.paymentId) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'PayHere payment ID is missing',
      code: 'PAYHERE_PAYMENT_ID_MISSING',
    }
  }

  const retrieval = await retrievePayHerePayment(intent.merchantOrderId)
  if (retrieval.status !== 1) {
    return {
      success: false,
      status: intent.status as 'REFUND_REQUIRED' | 'REFUND_PROCESSING',
      error: retrieval.message,
      code: 'PAYHERE_RETRIEVAL_FAILED',
    }
  }

  const payment = retrieval.payments.find(
    item => String(item.payment_id) === String(intent.paymentId)
  )
  if (!payment) {
    return {
      success: false,
      status: intent.status as 'REFUND_REQUIRED' | 'REFUND_PROCESSING',
      error: 'PayHere payment not found',
      code: 'PAYHERE_PAYMENT_NOT_FOUND',
    }
  }

  const gatewayStatus = normalizePayHereStatus(payment.status)
  if (gatewayStatus === 'REFUNDED') {
    return finalizePayHereRefund(paymentIntentId, {
      gatewayStatus,
      refundReference: null,
      message: retrieval.message,
    })
  }

  if (gatewayStatus === 'REFUND REQUESTED' || gatewayStatus === 'REFUND PROCESSING') {
    await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: { in: ['REFUND_REQUIRED', 'REFUND_PROCESSING'] } },
      data: {
        status: 'REFUND_PROCESSING',
        gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
          gatewayStatus,
          reconciledAt: new Date().toISOString(),
        }),
      },
    })
    return { success: true, status: 'REFUND_PROCESSING' }
  }

  if (gatewayStatus === 'RECEIVED' && intent.status === 'REFUND_REQUIRED') {
    return requestRequiredPayHereRefund(paymentIntentId)
  }

  return {
    success: false,
    status: intent.status as 'REFUND_REQUIRED' | 'REFUND_PROCESSING',
    error: `Unexpected PayHere refund status: ${gatewayStatus || 'UNKNOWN'}`,
    code: 'PAYHERE_REFUND_UNEXPECTED_STATUS',
  }
}

async function finalizeExternalProviderRefund(
  paymentIntentId: string,
  details: {
    provider: 'PAYHERE' | 'PAYPAL'
    gatewayStatus: string
    refundReference: string | null
    message: string
    actorId?: string
    source?: 'PAYHERE' | 'PAYPAL' | 'MANUAL'
  }
): Promise<PayHereRefundProcessingResult> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
  })
  if (!intent) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.status === 'REFUNDED') {
    return { success: true, status: 'REFUNDED', refundReference: details.refundReference }
  }

  const suspenseAccountId = `refund-suspense:${intent.id}`
  const suspenseFunding = await prisma.financialLedger.findFirst({
    where: {
      referenceType: 'PAYMENT_REFUND_SUSPENSE',
      referenceId: intent.id,
      accountId: suspenseAccountId,
      accountType: 'REFUND_SUSPENSE',
      entryType: 'CREDIT',
    },
    select: { id: true, amount: true, currency: true },
  })

  const escrow = suspenseFunding
    ? null
    : await prisma.jobEscrow.findUnique({ where: { id: intent.escrowId } })

  if (!suspenseFunding && !escrow) {
    return {
      success: false,
      status: intent.status as 'REFUND_REQUIRED' | 'REFUND_PROCESSING',
      error: 'Refund funding source could not be resolved',
      code: 'REFUND_FUNDING_SOURCE_NOT_FOUND',
    }
  }

  if (
    !suspenseFunding &&
    escrow &&
    (escrow.totalAmount !== intent.amount || escrow.currency !== intent.currency)
  ) {
    return {
      success: false,
      status: intent.status as 'REFUND_REQUIRED' | 'REFUND_PROCESSING',
      error: 'Escrow amount or currency no longer matches the captured payment',
      code: 'REFUND_ESCROW_MISMATCH',
    }
  }

  const actorId =
    details.actorId ||
    `system:${details.provider.toLowerCase()}-refund`
  const actorType = details.source === 'MANUAL' ? 'STAFF' : 'SYSTEM'
  const externalAccountId = `external:${details.provider.toLowerCase()}`
  const providerKey = details.provider.toLowerCase()

  await prisma.$transaction(async tx => {
    const claimed = await tx.paymentIntent.updateMany({
      where: {
        id: intent.id,
        status: { in: ['REFUND_REQUIRED', 'REFUND_PROCESSING'] },
      },
      data: {
        status: 'REFUNDED',
        gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
          gatewayStatus: details.gatewayStatus,
          refundReference: details.refundReference,
          message: details.message,
          completedAt: new Date().toISOString(),
          fundingSource: suspenseFunding ? 'REFUND_SUSPENSE' : 'ESCROW',
        }),
      },
    })
    if (claimed.count !== 1) {
      const current = await tx.paymentIntent.findUnique({
        where: { id: intent.id },
        select: { status: true },
      })
      if (current?.status === 'REFUNDED') return
      throw new Error('Payment refund state changed concurrently')
    }

    if (suspenseFunding) {
      if (suspenseFunding.amount !== intent.amount || suspenseFunding.currency !== intent.currency) {
        throw new Error('Refund suspense ledger amount or currency does not match payment intent')
      }

      await postLedgerTransaction({
        entries: [
          {
            accountId: suspenseAccountId,
            accountType: 'REFUND_SUSPENSE',
            entryType: 'DEBIT',
            amount: intent.amount,
          },
          {
            accountId: externalAccountId,
            accountType: 'EXTERNAL_PAYOUT',
            entryType: 'CREDIT',
            amount: intent.amount,
          },
        ],
        currency: intent.currency as Currency,
        referenceType: 'PAYMENT_EXTERNAL_REFUND',
        referenceId: intent.id,
        idempotencyKey: `${providerKey}-refund-suspense-release:${intent.id}:${intent.paymentId || intent.merchantOrderId}`,
        description: `External refund of late ${details.provider} capture ${intent.id}`,
        createdBy: actorId,
        metadata: JSON.stringify({
          paymentIntentId: intent.id,
          paymentId: intent.paymentId,
          merchantOrderId: intent.merchantOrderId,
          refundReference: details.refundReference,
          refundSource: details.source || details.provider,
          fundingSource: 'REFUND_SUSPENSE',
        }),
      }, tx)
    } else {
      const activeEscrow = escrow!
      const escrowClaimed = await tx.jobEscrow.updateMany({
        where: {
          id: activeEscrow.id,
          status: { in: ['ON_HOLD', 'PROTECTED'] },
        },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
        },
      })
      if (escrowClaimed.count !== 1) {
        throw new Error('Escrow is not awaiting external refund reconciliation')
      }

      await postLedgerTransaction({
        entries: [
          {
            accountId: `escrow:${activeEscrow.id}`,
            accountType: 'ESCROW',
            entryType: 'DEBIT',
            amount: activeEscrow.totalAmount,
          },
          {
            accountId: externalAccountId,
            accountType: 'EXTERNAL_PAYOUT',
            entryType: 'CREDIT',
            amount: activeEscrow.totalAmount,
          },
        ],
        currency: activeEscrow.currency as Currency,
        referenceType: 'ESCROW_EXTERNAL_REFUND',
        referenceId: activeEscrow.id,
        idempotencyKey: `${providerKey}-refund:${activeEscrow.id}:${intent.paymentId || intent.merchantOrderId}`,
        description: `${details.provider} refund reconciliation for escrow ${activeEscrow.id}`,
        createdBy: actorId,
        metadata: JSON.stringify({
          paymentIntentId: intent.id,
          paymentId: intent.paymentId,
          merchantOrderId: intent.merchantOrderId,
          refundReference: details.refundReference,
          refundSource: details.source || details.provider,
          fundingSource: 'ESCROW',
        }),
      }, tx)
    }

    const resolvingDispute = await tx.marketplaceDispute.findFirst({
      where: {
        jobId: intent.jobId,
        escrowId: intent.escrowId,
        status: 'RESOLVING',
        resolutionAction: 'REFUND_CUSTOMER',
      },
      select: { id: true, resolution: true, resolvedBy: true },
    })

    if (resolvingDispute) {
      await tx.marketplaceDispute.update({
        where: { id: resolvingDispute.id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      })

      await tx.adminAlert.updateMany({
        where: {
          targetTable: 'MarketplaceDispute',
          targetId: resolvingDispute.id,
          status: { in: ['open', 'in_progress'] },
        },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: resolvingDispute.resolvedBy,
          notes: resolvingDispute.resolution || 'Customer refund completed',
        },
      })
    }

    await recordJobLifecycleEvent(tx, {
      jobId: intent.jobId,
      actorId,
      actorType,
      action: 'PAYMENT_REFUNDED',
      metadata: {
        paymentIntentId: intent.id,
        paymentId: intent.paymentId,
        escrowId: intent.escrowId,
        refundReference: details.refundReference,
        refundSource: details.source || details.provider,
        fundingSource: suspenseFunding ? 'REFUND_SUSPENSE' : 'ESCROW',
        refundMinor: suspenseFunding ? intent.amount : escrow!.totalAmount,
        currency: suspenseFunding ? intent.currency : escrow!.currency,
      },
    })
  })

  return {
    success: true,
    status: 'REFUNDED',
    refundReference: details.refundReference,
  }
}

async function finalizePayHereRefund(
  paymentIntentId: string,
  details: {
    gatewayStatus: string
    refundReference: string | null
    message: string
    actorId?: string
    source?: 'PAYHERE' | 'MANUAL'
  }
): Promise<PayHereRefundProcessingResult> {
  return finalizeExternalProviderRefund(paymentIntentId, {
    ...details,
    provider: 'PAYHERE',
  })
}

export async function requestRequiredPayPalRefund(
  paymentIntentId: string,
  approvalRequestId?: string
): Promise<PayHereRefundProcessingResult> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
  })
  if (!intent) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.gateway !== 'PAYPAL') {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment is not a PayPal transaction',
      code: 'PAYMENT_PROVIDER_MISMATCH',
    }
  }
  if (intent.status === 'REFUNDED') {
    return {
      success: true,
      status: 'REFUNDED',
      refundReference: intent.refundId,
    }
  }
  if (intent.status === 'REFUND_PROCESSING') {
    return reconcilePayPalRefund(paymentIntentId)
  }
  if (intent.status !== 'REFUND_REQUIRED') {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: `Payment is not awaiting refund (status=${intent.status})`,
      code: 'PAYMENT_NOT_REFUNDABLE',
    }
  }

  const transaction = await prisma.paymentProviderTransaction.findFirst({
    where: {
      paymentIntentId: intent.id,
      provider: 'PAYPAL',
      providerCaptureId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!transaction?.providerCaptureId) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'PayPal capture reference is missing',
      code: 'PAYPAL_CAPTURE_ID_MISSING',
    }
  }
  if (
    transaction.grossAmount !== intent.amount ||
    transaction.currency !== intent.currency
  ) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'PayPal provider transaction does not match the payment intent',
      code: 'PAYPAL_REFUND_TRANSACTION_MISMATCH',
    }
  }

  const claim = await prisma.paymentIntent.updateMany({
    where: {
      id: intent.id,
      gateway: 'PAYPAL',
      status: 'REFUND_REQUIRED',
    },
    data: {
      status: 'REFUND_PROCESSING',
      gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
        gatewayStatus: 'REFUND REQUEST CLAIMED',
        provider: 'PAYPAL',
        claimedAt: new Date().toISOString(),
      }),
    },
  })
  if (claim.count !== 1) {
    const current = await prisma.paymentIntent.findUnique({
      where: { id: intent.id },
      select: { status: true },
    })
    if (current?.status === 'REFUNDED') {
      return { success: true, status: 'REFUNDED' }
    }
    if (current?.status === 'REFUND_PROCESSING') {
      return reconcilePayPalRefund(paymentIntentId)
    }
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Refund request state changed concurrently',
      code: 'PAYPAL_REFUND_STATE_CHANGED',
    }
  }

  const job = await prisma.marketplaceJob.findUnique({
    where: { id: intent.jobId },
    select: { countryCode: true },
  })
  if (!job) {
    await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: 'REFUND_PROCESSING' },
      data: { status: 'REFUND_REQUIRED' },
    })
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment job not found',
      code: 'PAYMENT_JOB_NOT_FOUND',
    }
  }

  const requestRecord = await prisma.paymentProviderRefund.create({
    data: {
      paymentIntentId: intent.id,
      providerTransactionId: transaction.id,
      countryCode: job.countryCode,
      provider: 'PAYPAL',
      amount: intent.amount,
      currency: intent.currency,
      status: 'REQUESTING',
      reason: 'Approved MaintainEX customer refund',
      approvalRequestId: approvalRequestId || null,
      metadata: JSON.stringify({
        providerCaptureId: transaction.providerCaptureId,
      }),
    },
  })

  const refund = await refundPayPalCapture(
    transaction.providerCaptureId,
    intent.id,
    {
      amountMinor: intent.amount,
      currency: intent.currency,
      refundRequestKey: requestRecord.id,
    }
  )

  if (!refund.ok || !refund.refundId) {
    await prisma.$transaction([
      prisma.paymentProviderRefund.update({
        where: { id: requestRecord.id },
        data: {
          status: 'FAILED',
          metadata: JSON.stringify({
            providerCaptureId: transaction.providerCaptureId,
            httpStatus: refund.status,
            error: refund.error || 'PayPal refund request failed',
          }),
        },
      }),
      prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'REFUND_REQUIRED',
          gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
            provider: 'PAYPAL',
            gatewayStatus: 'REFUND REQUEST FAILED',
            error: refund.error || 'PayPal refund request failed',
            failedAt: new Date().toISOString(),
          }),
        },
      }),
    ])

    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: refund.error || 'PayPal refund request failed',
      code: 'PAYPAL_REFUND_REQUEST_FAILED',
    }
  }

  const providerStatus = (refund.refundStatus || 'PENDING').toUpperCase()
  await prisma.$transaction(async tx => {
    await tx.paymentProviderRefund.update({
      where: { id: requestRecord.id },
      data: {
        providerRefundId: refund.refundId,
        status: providerStatus,
        completedAt: providerStatus === 'COMPLETED' ? new Date() : null,
        metadata: JSON.stringify({
          providerCaptureId: transaction.providerCaptureId,
          providerStatus,
        }),
      },
    })
    await tx.paymentIntent.update({
      where: { id: intent.id },
      data: {
        refundId: refund.refundId,
        gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
          provider: 'PAYPAL',
          gatewayStatus: providerStatus,
          refundReference: refund.refundId,
          requestedAt: new Date().toISOString(),
        }),
      },
    })
    await recordJobLifecycleEvent(tx, {
      jobId: intent.jobId,
      actorId: 'system:paypal-refund',
      actorType: 'SYSTEM',
      action: 'PAYMENT_REFUND_SUBMITTED',
      metadata: {
        paymentIntentId: intent.id,
        paymentId: transaction.providerCaptureId,
        refundReference: refund.refundId,
        approvalRequestId: approvalRequestId || null,
        provider: 'PAYPAL',
      },
    })
  })

  if (providerStatus === 'COMPLETED') {
    return finalizeExternalProviderRefund(intent.id, {
      provider: 'PAYPAL',
      gatewayStatus: providerStatus,
      refundReference: refund.refundId,
      message: 'PayPal refund completed',
      source: 'PAYPAL',
    })
  }

  return {
    success: true,
    status: 'REFUND_PROCESSING',
    refundReference: refund.refundId,
  }
}

export async function reconcilePayPalRefund(
  paymentIntentId: string
): Promise<PayHereRefundProcessingResult> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
  })
  if (!intent) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.gateway !== 'PAYPAL') {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment is not a PayPal transaction',
      code: 'PAYMENT_PROVIDER_MISMATCH',
    }
  }
  if (intent.status === 'REFUNDED') {
    return {
      success: true,
      status: 'REFUNDED',
      refundReference: intent.refundId,
    }
  }
  if (!['REFUND_REQUIRED', 'REFUND_PROCESSING'].includes(intent.status)) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: `Payment is not in the refund queue (status=${intent.status})`,
      code: 'PAYMENT_NOT_IN_REFUND_QUEUE',
    }
  }

  const refundRecord = await prisma.paymentProviderRefund.findFirst({
    where: {
      paymentIntentId: intent.id,
      provider: 'PAYPAL',
      providerRefundId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!refundRecord?.providerRefundId) {
    return {
      success: false,
      status: intent.status as 'REFUND_REQUIRED' | 'REFUND_PROCESSING',
      error: 'PayPal refund reference is missing',
      code: 'PAYPAL_REFUND_ID_MISSING',
    }
  }

  const refund = await getPayPalRefund(refundRecord.providerRefundId)
  if (!refund.ok) {
    return {
      success: false,
      status: intent.status as 'REFUND_REQUIRED' | 'REFUND_PROCESSING',
      error: refund.error || 'PayPal refund retrieval failed',
      code: 'PAYPAL_REFUND_RETRIEVAL_FAILED',
      refundReference: refundRecord.providerRefundId,
    }
  }

  const providerStatus = (refund.refundStatus || 'PENDING').toUpperCase()
  await prisma.paymentProviderRefund.update({
    where: { id: refundRecord.id },
    data: {
      status: providerStatus,
      completedAt: providerStatus === 'COMPLETED' ? new Date() : null,
    },
  })

  if (refund.amountValue && refund.currency) {
    const refundedMinor = parsePayPalAmountToMinor(
      refund.amountValue,
      refund.currency
    )
    if (
      refundedMinor === null ||
      refundedMinor !== intent.amount ||
      refund.currency.toUpperCase() !== intent.currency.toUpperCase()
    ) {
      return {
        success: false,
        status: 'REFUND_PROCESSING',
        error: 'PayPal refund amount or currency does not match the canonical payment',
        code: 'PAYPAL_REFUND_AMOUNT_MISMATCH',
        refundReference: refundRecord.providerRefundId,
      }
    }
  }

  if (providerStatus === 'COMPLETED') {
    return finalizeExternalProviderRefund(intent.id, {
      provider: 'PAYPAL',
      gatewayStatus: providerStatus,
      refundReference: refundRecord.providerRefundId,
      message: 'PayPal refund reconciliation completed',
      source: 'PAYPAL',
    })
  }

  if (['PENDING', 'PROCESSING'].includes(providerStatus)) {
    await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: { in: ['REFUND_REQUIRED', 'REFUND_PROCESSING'] } },
      data: { status: 'REFUND_PROCESSING' },
    })
    return {
      success: true,
      status: 'REFUND_PROCESSING',
      refundReference: refundRecord.providerRefundId,
    }
  }

  return {
    success: false,
    status: intent.status as 'REFUND_REQUIRED' | 'REFUND_PROCESSING',
    error: `Unexpected PayPal refund status: ${providerStatus}`,
    code: 'PAYPAL_REFUND_UNEXPECTED_STATUS',
    refundReference: refundRecord.providerRefundId,
  }
}

export async function requestRequiredProviderRefund(
  paymentIntentId: string,
  approvalRequestId?: string
): Promise<PayHereRefundProcessingResult> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
    select: { gateway: true },
  })
  if (!intent) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.gateway === 'PAYPAL') {
    return requestRequiredPayPalRefund(paymentIntentId, approvalRequestId)
  }
  if (intent.gateway === 'PAYHERE') {
    return requestRequiredPayHereRefund(paymentIntentId)
  }
  return {
    success: false,
    status: 'REFUND_REQUIRED',
    error: `Refund execution is unsupported for provider ${intent.gateway}`,
    code: 'PAYMENT_PROVIDER_REFUND_UNSUPPORTED',
  }
}

export async function reconcileProviderRefund(
  paymentIntentId: string
): Promise<PayHereRefundProcessingResult> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
    select: { gateway: true },
  })
  if (!intent) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.gateway === 'PAYPAL') {
    return reconcilePayPalRefund(paymentIntentId)
  }
  if (intent.gateway === 'PAYHERE') {
    return reconcilePayHereRefund(paymentIntentId)
  }
  return {
    success: false,
    status: 'REFUND_REQUIRED',
    error: `Refund reconciliation is unsupported for provider ${intent.gateway}`,
    code: 'PAYMENT_PROVIDER_REFUND_UNSUPPORTED',
  }
}

export async function confirmManualExternalRefund(
  paymentIntentId: string,
  input: {
    actorId: string
    reference: string
    note?: string
  }
): Promise<PayHereRefundProcessingResult> {
  const reference = input.reference.trim()
  if (reference.length < 4 || reference.length > 200) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'A manual refund reference is required',
      code: 'MANUAL_REFUND_REFERENCE_REQUIRED',
    }
  }

  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
    select: { id: true, status: true, gateway: true },
  })
  if (!intent) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.status === 'REFUNDED') {
    return { success: true, status: 'REFUNDED', refundReference: reference }
  }
  if (!['REFUND_REQUIRED', 'REFUND_PROCESSING'].includes(intent.status)) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: `Payment is not awaiting refund (status=${intent.status})`,
      code: 'PAYMENT_NOT_IN_REFUND_QUEUE',
    }
  }

  const provider =
    intent.gateway === 'PAYPAL'
      ? 'PAYPAL'
      : intent.gateway === 'PAYHERE'
        ? 'PAYHERE'
        : null
  if (!provider) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: `Manual external refund is unsupported for gateway ${intent.gateway}`,
      code: 'PAYMENT_PROVIDER_REFUND_UNSUPPORTED',
    }
  }

  return finalizeExternalProviderRefund(paymentIntentId, {
    provider,
    gatewayStatus: 'MANUAL_REFUND_CONFIRMED',
    refundReference: reference,
    message: input.note?.trim().slice(0, 500) || 'Manual external refund confirmed by finance',
    actorId: input.actorId,
    source: 'MANUAL',
  })
}

