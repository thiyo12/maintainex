import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/ledger'
import { recordJobLifecycleEvent } from '@/lib/domain/job-lifecycle-audit'
import { notifyEscrowDeposited } from '@/lib/notifications'
import { bigIntToSafeNumber, minorUnitsToMajorUnits, type Currency } from '@/lib/shared/money/money'
import { getPayHereConfig, generateCheckoutHash, getPayHereCheckoutUrl, getPayHereReturnUrl, getPayHereCancelUrl, getPayHereNotifyUrl, generateMerchantOrderId, formatPayHereAmount, parsePayHereAmount, type PayHereNotification } from '@/lib/payment/payhere-adapter'

export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUND_REQUIRED' | 'CHARGEDBACK'

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

async function markCapturedPaymentForRefund(
  paymentIntent: {
    id: string
    jobId: string
    customerId: string
    status: string
  },
  notification: PayHereNotification,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  await prisma.$transaction(async (tx) => {
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
      if (current?.status === 'REFUND_REQUIRED' || current?.status === 'SUCCESS') return
      throw new Error('Payment intent state changed while recording late payment')
    }

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
        reason,
      },
    })
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

  if (paymentIntent.status === 'SUCCESS' || paymentIntent.status === 'REFUND_REQUIRED') {
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
    return { success: false, error: 'Payment intent and escrow mismatch' }
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
      const lateClaim = await tx.paymentIntent.updateMany({
        where: { id: paymentIntent.id, status: { in: ['CREATED', 'PENDING'] } },
        data: {
          status: 'REFUND_REQUIRED',
          paymentId: notification.payment_id || null,
          gatewayResponse: JSON.stringify(notification),
          paidAt: new Date(),
        },
      })
      if (lateClaim.count === 1) {
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
              reason: 'Booking was no longer QUOTE_ACCEPTED when successful payment arrived',
            }),
          },
        })
      }
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

  if (paymentIntent.status === 'SUCCESS' || paymentIntent.status === 'REFUND_REQUIRED') {
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
