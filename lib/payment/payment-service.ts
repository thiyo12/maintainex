import { prisma } from '@/lib/prisma'
import { postLedgerTransaction } from '@/lib/ledger'
import { bigIntToSafeNumber, type Currency } from '@/lib/money'
import { getPayHereConfig, generateCheckoutHash, getPayHereCheckoutUrl, getPayHereReturnUrl, getPayHereCancelUrl, getPayHereNotifyUrl, generateMerchantOrderId, formatPayHereAmount, parsePayHereAmount, type PayHereNotification } from './payhere-adapter'

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

  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return { success: false, error: 'Job not found', code: 'JOB_NOT_FOUND' }
  if (job.customerId !== customerId) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }
  if (job.status !== 'QUOTE_ACCEPTED') {
    return { success: false, error: 'Job is not payable', code: 'JOB_NOT_PAYABLE' }
  }

  const escrow = await prisma.jobEscrow.findFirst({ where: { jobId } })
  if (!escrow) return { success: false, error: 'Escrow not initialized', code: 'ESCROW_NOT_INITIALIZED' }
  if (escrow.status !== 'PENDING_PAYMENT') {
    return { success: false, error: 'Escrow is not awaiting payment', code: 'ESCROW_NOT_FUNDABLE' }
  }

  const existingPending = await prisma.paymentIntent.findFirst({
    where: { jobId, status: { in: ['CREATED', 'PENDING'] } },
  })
  if (existingPending) {
    const user = await prisma.user.findUnique({
      where: { id: customerId },
      select: { name: true, email: true, phone: true },
    })
    const nameParts = (user?.name || 'Customer').split(' ')
    const firstName = nameParts[0] || 'Customer'
    const lastName = nameParts.slice(1).join(' ') || 'User'
    const checkoutUrl = buildCheckoutUrl(config, {
      merchantOrderId: existingPending.merchantOrderId,
      amount: formatPayHereAmount(existingPending.amount),
      currency: existingPending.currency,
      firstName,
      lastName,
      email: user?.email || undefined,
      phone: user?.phone || undefined,
      jobId,
      jobTitle: job.title || 'Service',
    }, baseUrl)
    return {
      success: true,
      paymentIntentId: existingPending.id,
      checkoutUrl,
      merchantOrderId: existingPending.merchantOrderId,
    }
  }

  const merchantOrderId = generateMerchantOrderId(jobId)
  const totalAmount = escrow.totalAmount ?? escrow.amount
  const amountFormatted = formatPayHereAmount(totalAmount)

  const paymentIntent = await prisma.paymentIntent.create({
    data: {
      jobId,
      customerId,
      escrowId: escrow.id,
      merchantOrderId,
      amount: totalAmount,
      currency: (escrow.currency || 'LKR') as Currency,
      status: 'CREATED',
    },
  })

  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { name: true, email: true, phone: true },
  })

  const nameParts = (user?.name || 'Customer').split(' ')
  const firstName = nameParts[0] || 'Customer'
  const lastName = nameParts.slice(1).join(' ') || 'User'

  const checkoutUrl = buildCheckoutUrl(config, {
    merchantOrderId,
    amount: amountFormatted,
    currency: escrow.currency || 'LKR',
    firstName,
    lastName,
    email: user?.email || undefined,
    phone: user?.phone || undefined,
    jobId,
    jobTitle: job.title || 'Service',
  }, baseUrl)

  return {
    success: true,
    paymentIntentId: paymentIntent.id,
    checkoutUrl,
    merchantOrderId,
  }
}

function buildCheckoutUrl(
  config: ReturnType<typeof getPayHereConfig> & {},
  data: {
    merchantOrderId: string
    amount: string
    currency: string
    firstName: string
    lastName: string
    email?: string
    phone?: string
    jobId: string
    jobTitle: string
  },
  baseUrl: string
): string {
  const params = new URLSearchParams()
  params.set('merchant_id', config.merchantId)
  params.set('return_url', getPayHereReturnUrl(baseUrl, data.jobId))
  params.set('cancel_url', getPayHereCancelUrl(baseUrl, data.jobId))
  params.set('notify_url', getPayHereNotifyUrl(baseUrl))
  params.set('order_id', data.merchantOrderId)
  params.set('items', data.jobTitle)
  params.set('amount', data.amount)
  params.set('currency', data.currency)
  params.set('first_name', data.firstName)
  params.set('last_name', data.lastName)
  if (data.email) params.set('email', data.email)
  if (data.phone) params.set('phone', data.phone)
  params.set('country', 'Sri Lanka')
  params.set('custom_1', data.jobId)

  const hash = generateCheckoutHash(
    config.merchantId,
    data.merchantOrderId,
    data.amount,
    data.currency,
    config.merchantSecret
  )
  params.set('hash', hash)

  const baseUrlStr = config.sandbox
    ? 'https://sandbox.payhere.lk/pay/checkout'
    : 'https://www.payhere.lk/pay/checkout'

  return `${baseUrlStr}?${params.toString()}`
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
    amount: payment.amount.toString(),
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

  return prisma.$transaction(async (tx) => {
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
      return { success: true }
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

    return { success: true }
  })
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
      await tx.paymentIntent.updateMany({
        where: { id: paymentIntent.id, status: { not: 'CHARGEDBACK' } },
        data: {
          status: 'CHARGEDBACK',
          paymentId: notification.payment_id || paymentIntent.paymentId,
          gatewayResponse: JSON.stringify(notification),
        },
      })

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
    where: { status: 'CREATED', createdAt: { lt: cutoff } },
    data: { status: 'EXPIRED' },
  })
  return result.count
}
