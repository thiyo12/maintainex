import type { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/finance/ledger/ledger-service'
import { recordJobLifecycleEvent } from '@/lib/domain/job-lifecycle-audit'
import { notifyEscrowDeposited } from '@/lib/notifications'
import { bigIntToSafeNumber, minorUnitsToMajorUnits, type Currency } from '@/lib/shared/money/money'
import {
  getPayHereConfig,
  generateCheckoutHash,
  getPayHereCheckoutUrl,
  getPayHereReturnUrl,
  getPayHereCancelUrl,
  getPayHereNotifyUrl,
  generateMerchantOrderId,
  formatPayHereAmount,
  parsePayHereAmount,
  requestPayHereRefund,
  retrievePayHerePayment,
  type PayHereNotification,
} from '@/lib/payment/payhere-adapter'

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
  error?: string
  code?: string
}

export async function createPaymentIntent(params: CreatePaymentParams): Promise<PaymentResult> {
  const { jobId, customerId, baseUrl } = params

  const config = getPayHereConfig()
  if (!config) {
    return { success: false, error: 'Payment gateway not configured', code: 'PAYHERE_NOT_CONFIGURED' }
  }

  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { name: true, email: true, phone: true },
  })
  if (!user?.email || !user?.phone) {
    return {
      success: false,
      error: 'A verified email and phone number are required before card payment',
      code: 'CUSTOMER_PAYMENT_DETAILS_REQUIRED',
    }
  }

  const buildResult = (intent: { id: string; merchantOrderId: string }): PaymentResult => ({
    success: true,
    paymentIntentId: intent.id,
    checkoutUrl: buildHostedCheckoutUrl(baseUrl, intent.id, config.merchantSecret),
    merchantOrderId: intent.merchantOrderId,
  })

  type IntentDecision = {
    intent: { id: string; merchantOrderId: string } | null
    failure: PaymentResult | null
  }

  const decision: IntentDecision = await prisma.$transaction(async (tx) => {
    const lockedJobs = await tx.$queryRaw<{ id: string; customerId: string; status: string }[]>`
      SELECT id, "customerId", status
      FROM "MarketplaceJob"
      WHERE id = ${jobId}
      FOR UPDATE
    `
    const job = lockedJobs[0]
    if (!job) {
      return {
        intent: null,
        failure: { success: false, error: 'Job not found', code: 'JOB_NOT_FOUND' },
      }
    }
    if (job.customerId !== customerId) {
      return {
        intent: null,
        failure: { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      }
    }
    if (job.status !== 'QUOTE_ACCEPTED') {
      return {
        intent: null,
        failure: { success: false, error: 'Job is not payable', code: 'JOB_NOT_PAYABLE' },
      }
    }

    const escrow = await tx.jobEscrow.findFirst({ where: { jobId } })
    if (!escrow) {
      return {
        intent: null,
        failure: { success: false, error: 'Escrow not initialized', code: 'ESCROW_NOT_INITIALIZED' },
      }
    }
    if (escrow.status !== 'PENDING_PAYMENT') {
      return {
        intent: null,
        failure: { success: false, error: 'Escrow is not awaiting payment', code: 'ESCROW_NOT_FUNDABLE' },
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

    const existingPending = await tx.paymentIntent.findFirst({
      where: { jobId, status: { in: ['CREATED', 'PENDING'] } },
      select: { id: true, merchantOrderId: true },
    })
    if (existingPending) {
      return { intent: existingPending, failure: null }
    }

    const totalAmount = escrow.totalAmount ?? escrow.amount
    const paymentIntent = await tx.paymentIntent.create({
      data: {
        jobId,
        customerId,
        escrowId: escrow.id,
        merchantOrderId: generateMerchantOrderId(jobId),
        amount: totalAmount,
        currency: (escrow.currency || 'LKR') as Currency,
        status: 'CREATED',
      },
      select: { id: true, merchantOrderId: true },
    })

    return { intent: paymentIntent, failure: null }
  })

  if (decision.failure) return decision.failure
  if (!decision.intent) {
    return { success: false, error: 'Could not create payment session', code: 'PAYMENT_INTENT_FAILED' }
  }
  return buildResult(decision.intent)
}

function checkoutToken(intentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`maintainex-payhere:${intentId}`).digest('hex')
}

function buildHostedCheckoutUrl(baseUrl: string, intentId: string, secret: string): string {
  const origin = new URL(baseUrl).origin
  const token = checkoutToken(intentId, secret)
  return `${origin}/api/payments/payhere/${encodeURIComponent(intentId)}?token=${token}`
}

export function verifyHostedCheckoutToken(intentId: string, token: string, secret: string): boolean {
  const expected = checkoutToken(intentId, secret)
  if (token.length !== expected.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(expected, 'utf8'))
  } catch {
    return false
  }
}

export async function getPaymentCheckoutForm(
  intentId: string,
  token: string,
  baseUrl: string,
): Promise<{ actionUrl: string; fields: Record<string, string> } | null> {
  const config = getPayHereConfig()
  if (!config || !verifyHostedCheckoutToken(intentId, token, config.merchantSecret)) return null

  const paymentIntent = await prisma.paymentIntent.findUnique({ where: { id: intentId } })
  if (!paymentIntent || !['CREATED', 'PENDING'].includes(paymentIntent.status)) return null

  if (paymentIntent.createdAt.getTime() < Date.now() - 30 * 60 * 1000) {
    await prisma.paymentIntent.updateMany({
      where: { id: paymentIntent.id, status: { in: ['CREATED', 'PENDING'] } },
      data: { status: 'EXPIRED' },
    })
    return null
  }

  const [job, user] = await Promise.all([
    prisma.marketplaceJob.findUnique({ where: { id: paymentIntent.jobId } }),
    prisma.user.findUnique({
      where: { id: paymentIntent.customerId },
      select: { name: true, email: true, phone: true },
    }),
  ])
  if (!job || !user?.email || !user?.phone || job.customerId !== paymentIntent.customerId) return null
  if (job.status !== 'QUOTE_ACCEPTED') return null

  const escrow = await prisma.jobEscrow.findUnique({ where: { id: paymentIntent.escrowId } })
  if (
    !escrow ||
    escrow.jobId !== job.id ||
    escrow.customerId !== paymentIntent.customerId ||
    escrow.status !== 'PENDING_PAYMENT' ||
    escrow.totalAmount !== paymentIntent.amount ||
    escrow.currency !== paymentIntent.currency
  ) {
    return null
  }

  const area = job.areaId
    ? await prisma.area.findUnique({
        where: { id: job.areaId },
        include: { city: true },
      })
    : null

  const nameParts = (user.name || 'Customer').trim().split(/\s+/)
  const firstName = nameParts[0] || 'Customer'
  const lastName = nameParts.slice(1).join(' ') || 'User'
  const address = [
    job.addressStreet,
    job.addressBuilding,
    job.addressApartment,
    job.addressLandmark,
    area?.name,
  ].filter(Boolean).join(', ') || 'Service booking'
  const city = area?.city?.name || 'Sri Lanka'
  const amount = formatPayHereAmount(paymentIntent.amount)

  await prisma.paymentIntent.updateMany({
    where: { id: paymentIntent.id, status: 'CREATED' },
    data: { status: 'PENDING' },
  })

  return {
    actionUrl: getPayHereCheckoutUrl(config.sandbox),
    fields: {
      merchant_id: config.merchantId,
      return_url: getPayHereReturnUrl(baseUrl, job.id),
      cancel_url: getPayHereCancelUrl(baseUrl, job.id),
      notify_url: getPayHereNotifyUrl(baseUrl),
      first_name: firstName,
      last_name: lastName,
      email: user.email,
      phone: user.phone,
      address,
      city,
      country: job.countryCode === 'LK' ? 'Sri Lanka' : job.countryCode,
      order_id: paymentIntent.merchantOrderId,
      items: job.title || 'MaintainEX service',
      currency: paymentIntent.currency,
      amount,
      custom_1: job.id,
      hash: generateCheckoutHash(
        config.merchantId,
        paymentIntent.merchantOrderId,
        amount,
        paymentIntent.currency,
        config.merchantSecret,
      ),
    },
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

  const refund = await requestPayHereRefund(
    String(intent.paymentId),
    `MaintainEX refund for order ${intent.merchantOrderId}`
  )
  if (refund.status !== 1) {
    return {
      success: false,
      status: 'REFUND_REQUIRED',
      error: refund.message,
      code: 'PAYHERE_REFUND_REQUEST_FAILED',
      refundReference: refund.refundReference,
    }
  }

  await prisma.$transaction(async tx => {
    const claimed = await tx.paymentIntent.updateMany({
      where: { id: intent.id, status: 'REFUND_REQUIRED' },
      data: {
        status: 'REFUND_PROCESSING',
        gatewayResponse: mergeGatewayResponse(intent.gatewayResponse, 'refund', {
          gatewayStatus: 'REFUND REQUESTED',
          refundReference: refund.refundReference,
          message: refund.message,
          requestedAt: new Date().toISOString(),
        }),
      },
    })
    if (claimed.count !== 1) return

    await recordJobLifecycleEvent(tx, {
      jobId: intent.jobId,
      actorId: details.actorId || 'system:payhere-refund',
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

  const escrow = await prisma.jobEscrow.findUnique({
    where: { id: intent.escrowId },
  })
  if (!escrow) {
    return {
      success: false,
      status: intent.status as 'REFUND_REQUIRED' | 'REFUND_PROCESSING',
      error: 'Escrow not found',
      code: 'ESCROW_NOT_FOUND',
    }
  }

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

    const escrowClaimed = await tx.jobEscrow.updateMany({
      where: {
        id: escrow.id,
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
          accountId: `escrow:${escrow.id}`,
          accountType: 'ESCROW',
          entryType: 'DEBIT',
          amount: escrow.totalAmount,
        },
        {
          accountId: 'external:payhere',
          accountType: 'EXTERNAL_PAYOUT',
          entryType: 'CREDIT',
          amount: escrow.totalAmount,
        },
      ],
      currency: escrow.currency as Currency,
      referenceType: 'ESCROW_EXTERNAL_REFUND',
      referenceId: escrow.id,
      idempotencyKey: `payhere-refund:${escrow.id}:${intent.paymentId || intent.merchantOrderId}`,
      description: `PayHere refund reconciliation for escrow ${escrow.id}`,
      createdBy: details.actorId || 'system:payhere-refund',
      metadata: JSON.stringify({
        paymentIntentId: intent.id,
        paymentId: intent.paymentId,
        merchantOrderId: intent.merchantOrderId,
        refundReference: details.refundReference,
        refundSource: details.source || 'PAYHERE',
      }),
    }, tx)

    await recordJobLifecycleEvent(tx, {
      jobId: intent.jobId,
      actorId: details.actorId || 'system:payhere-refund',
      actorType: 'SYSTEM',
      action: 'PAYMENT_REFUNDED',
      metadata: {
        paymentIntentId: intent.id,
        paymentId: intent.paymentId,
        escrowId: escrow.id,
        refundReference: details.refundReference,
        refundSource: details.source || 'PAYHERE',
        refundMinor: escrow.totalAmount,
        currency: escrow.currency,
      },
    })
  })

  return {
    success: true,
    status: 'REFUNDED',
    refundReference: details.refundReference,
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
    select: { id: true, status: true },
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

  return finalizePayHereRefund(paymentIntentId, {
    gatewayStatus: 'MANUAL_REFUND_CONFIRMED',
    refundReference: reference,
    message: input.note?.trim().slice(0, 500) || 'Manual external refund confirmed by finance',
    actorId: input.actorId,
    source: 'MANUAL',
  })
}

