import { prisma } from '@/lib/prisma'
import { recordJobLifecycleEvent } from '@/lib/domain/job-lifecycle-audit'
import {
  capturePayPalOrder,
  getPayPalOrder,
  parsePayPalAmountToMinor,
  parsePayPalCaptureResource,
  type PayPalCaptureResult,
} from '@/lib/finance/payments/paypal-adapter'
import {
  finalizeProviderCapture,
  type ProviderCaptureResult,
} from '@/lib/finance/payments/canonical-capture'
import {
  markProviderEventProcessed,
  recordVerifiedProviderEvent,
} from '@/lib/finance/payments/provider-events'

type RecordObject = Record<string, unknown>

export type PayPalFinalizeResult = ProviderCaptureResult & {
  jobId?: string
  pending?: boolean
  orderStatus?: string | null
  captureStatus?: string | null
}

function objectValue(value: unknown): RecordObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordObject
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseProviderMoney(value: string | undefined, currency: string): bigint | null {
  if (!value) return null
  try {
    return parsePayPalAmountToMinor(value, currency)
  } catch {
    return null
  }
}

function finalizeFromPayPalResult(
  result: PayPalCaptureResult,
  paymentIntentId: string,
  expectedOrderId: string
): Promise<PayPalFinalizeResult> {
  const orderId = result.orderId || expectedOrderId
  const currency = result.currency?.trim().toUpperCase() || ''
  const amountMinor = currency
    ? parseProviderMoney(result.amountValue, currency)
    : null
  const feeMinor = currency
    ? parseProviderMoney(result.providerFeeValue, currency)
    : null
  const netMinor = currency
    ? parseProviderMoney(result.netSettlementValue, currency)
    : null

  if (
    !result.captureId ||
    !currency ||
    amountMinor === null ||
    result.captureStatus?.toUpperCase() !== 'COMPLETED'
  ) {
    return Promise.resolve({
      success: false,
      paymentIntentId,
      orderStatus: result.orderStatus || null,
      captureStatus: result.captureStatus || null,
      pending:
        result.captureStatus?.toUpperCase() === 'PENDING' ||
        result.orderStatus?.toUpperCase() === 'APPROVED',
      error: 'PayPal capture is not complete',
      code: 'PAYPAL_CAPTURE_NOT_COMPLETE',
    })
  }

  return finalizeProviderCapture({
    provider: 'PAYPAL',
    paymentIntentId,
    providerOrderId: orderId,
    providerCaptureId: result.captureId,
    amountMinor,
    currency,
    providerFeeMinor: feeMinor,
    netSettlementMinor: netMinor,
    providerStatus: result.captureStatus,
  })
}

export async function captureAndFinalizePayPal(input: {
  paymentIntentId: string
  orderId: string
}): Promise<PayPalFinalizeResult> {
  const paymentIntentId = input.paymentIntentId.trim()
  const orderId = input.orderId.trim()
  if (!paymentIntentId || !orderId) {
    return {
      success: false,
      error: 'Missing PayPal payment reference',
      code: 'PAYPAL_REFERENCE_REQUIRED',
    }
  }

  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
    select: {
      id: true,
      jobId: true,
      gateway: true,
      merchantOrderId: true,
      status: true,
    },
  })
  if (!intent) {
    return {
      success: false,
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.gateway !== 'PAYPAL' || intent.merchantOrderId !== orderId) {
    return {
      success: false,
      paymentIntentId: intent.id,
      jobId: intent.jobId,
      error: 'PayPal order does not match payment intent',
      code: 'PAYPAL_REFERENCE_MISMATCH',
    }
  }
  if (intent.status === 'SUCCESS') {
    return {
      success: true,
      paymentIntentId: intent.id,
      jobId: intent.jobId,
      newlyProtected: false,
    }
  }

  let capture = await capturePayPalOrder(orderId, intent.id)
  if (!capture.ok || !capture.captureId) {
    const retrieved = await getPayPalOrder(orderId)
    if (retrieved.ok && retrieved.captureId) capture = retrieved
  }

  const finalized = await finalizeFromPayPalResult(capture, intent.id, orderId)
  return {
    ...finalized,
    jobId: intent.jobId,
    orderStatus: capture.orderStatus || null,
    captureStatus: capture.captureStatus || null,
  }
}

export async function cancelPayPalCheckout(input: {
  paymentIntentId: string
  orderId: string
}): Promise<{
  success: boolean
  cancelled: boolean
  jobId?: string
  error?: string
  code?: string
}> {
  const paymentIntentId = input.paymentIntentId.trim()
  const orderId = input.orderId.trim()
  if (!paymentIntentId || !orderId) {
    return {
      success: false,
      cancelled: false,
      error: 'Missing PayPal payment reference',
      code: 'PAYPAL_REFERENCE_REQUIRED',
    }
  }

  const intent = await prisma.paymentIntent.findUnique({
    where: { id: paymentIntentId },
    select: {
      id: true,
      jobId: true,
      customerId: true,
      gateway: true,
      merchantOrderId: true,
      status: true,
    },
  })
  if (!intent) {
    return {
      success: false,
      cancelled: false,
      error: 'Payment intent not found',
      code: 'PAYMENT_INTENT_NOT_FOUND',
    }
  }
  if (intent.gateway !== 'PAYPAL' || intent.merchantOrderId !== orderId) {
    return {
      success: false,
      cancelled: false,
      jobId: intent.jobId,
      error: 'PayPal order does not match payment intent',
      code: 'PAYPAL_REFERENCE_MISMATCH',
    }
  }

  if (
    intent.status === 'SUCCESS' ||
    intent.status === 'REFUND_REQUIRED' ||
    intent.status === 'REFUND_PROCESSING' ||
    intent.status === 'REFUNDED'
  ) {
    return { success: true, cancelled: false, jobId: intent.jobId }
  }

  const remote = await getPayPalOrder(orderId)
  if (remote.ok && remote.captureId && remote.captureStatus === 'COMPLETED') {
    const finalized = await finalizeFromPayPalResult(remote, intent.id, orderId)
    return {
      success: finalized.success,
      cancelled: false,
      jobId: intent.jobId,
      error: finalized.error,
      code: finalized.code,
    }
  }

  await prisma.$transaction(async tx => {
    const claimed = await tx.paymentIntent.updateMany({
      where: {
        id: intent.id,
        gateway: 'PAYPAL',
        merchantOrderId: orderId,
        status: { in: ['CREATED', 'PENDING'] },
      },
      data: {
        status: 'CANCELLED',
        gatewayResponse: JSON.stringify({
          provider: 'PAYPAL',
          orderId,
          orderStatus: remote.orderStatus || null,
          cancelledAt: new Date().toISOString(),
        }),
      },
    })

    if (claimed.count === 1) {
      await recordJobLifecycleEvent(tx, {
        jobId: intent.jobId,
        actorId: intent.customerId,
        actorType: 'CUSTOMER',
        action: 'PAYMENT_CANCELLED',
        metadata: {
          paymentIntentId: intent.id,
          provider: 'PAYPAL',
          providerOrderId: orderId,
        },
      })
    }
  })

  return { success: true, cancelled: true, jobId: intent.jobId }
}

export function extractPayPalEventReferences(event: RecordObject): {
  eventId: string | null
  eventType: string | null
  orderId: string | null
  captureId: string | null
  refundId: string | null
  resource: RecordObject | null
  occurredAt: Date | null
} {
  const eventId = stringValue(event.id)
  const eventType = stringValue(event.event_type)
  const resource = objectValue(event.resource)
  const supplementary = objectValue(resource?.supplementary_data)
  const relatedIds = objectValue(supplementary?.related_ids)

  let orderId = stringValue(relatedIds?.order_id)
  let captureId = stringValue(relatedIds?.capture_id)
  let refundId: string | null = null

  if (eventType?.startsWith('CHECKOUT.ORDER.')) {
    orderId = stringValue(resource?.id) || orderId
  }
  if (eventType?.startsWith('PAYMENT.CAPTURE.')) {
    captureId = stringValue(resource?.id) || captureId
  }
  if (eventType?.startsWith('PAYMENT.CAPTURE.REFUNDED')) {
    refundId = stringValue(resource?.id)
    captureId = stringValue(relatedIds?.capture_id) || captureId
  }

  const links = Array.isArray(resource?.links)
    ? resource!.links.filter(
        (value): value is RecordObject =>
          Boolean(value) && typeof value === 'object' && !Array.isArray(value)
      )
    : []

  for (const link of links) {
    if (link.rel !== 'up' || typeof link.href !== 'string') continue
    const captureMatch = link.href.match(/\/captures\/([^/?#]+)/i)
    const orderMatch = link.href.match(/\/orders\/([^/?#]+)/i)
    if (!captureId && captureMatch) captureId = decodeURIComponent(captureMatch[1])
    if (!orderId && orderMatch) orderId = decodeURIComponent(orderMatch[1])
  }

  const occurredRaw = stringValue(event.create_time)
  const occurredAt = occurredRaw ? new Date(occurredRaw) : null

  return {
    eventId,
    eventType,
    orderId,
    captureId,
    refundId,
    resource,
    occurredAt:
      occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt : null,
  }
}

async function resolveIntentForPayPalEvent(refs: {
  orderId: string | null
  captureId: string | null
}) {
  if (refs.orderId) {
    const intent = await prisma.paymentIntent.findFirst({
      where: {
        gateway: 'PAYPAL',
        merchantOrderId: refs.orderId,
      },
      select: {
        id: true,
        jobId: true,
        escrowId: true,
        customerId: true,
        status: true,
        amount: true,
        currency: true,
        merchantOrderId: true,
      },
    })
    if (intent) {
      const job = await prisma.marketplaceJob.findUnique({
        where: { id: intent.jobId },
        select: { countryCode: true },
      })
      return {
        intent,
        countryCode: job?.countryCode || null,
        providerTransactionId: null as string | null,
      }
    }
  }

  if (refs.captureId) {
    const transaction = await prisma.paymentProviderTransaction.findFirst({
      where: {
        provider: 'PAYPAL',
        providerCaptureId: refs.captureId,
      },
      select: {
        id: true,
        paymentIntentId: true,
        countryCode: true,
      },
    })
    if (transaction) {
      const intent = await prisma.paymentIntent.findUnique({
        where: { id: transaction.paymentIntentId },
        select: {
          id: true,
          jobId: true,
          escrowId: true,
          customerId: true,
          status: true,
          amount: true,
          currency: true,
          merchantOrderId: true,
        },
      })
      if (intent) {
        return {
          intent,
          countryCode: transaction.countryCode,
          providerTransactionId: transaction.id,
        }
      }
    }
  }

  return null
}

async function processCompletedCapture(
  refs: ReturnType<typeof extractPayPalEventReferences>,
  resolved: NonNullable<Awaited<ReturnType<typeof resolveIntentForPayPalEvent>>>
): Promise<PayPalFinalizeResult> {
  const financials = parsePayPalCaptureResource(refs.resource)
  const currency = financials.currency?.trim().toUpperCase() || ''
  const amountMinor = currency
    ? parseProviderMoney(financials.amountValue, currency)
    : null
  if (
    !refs.orderId ||
    !financials.captureId ||
    !currency ||
    amountMinor === null
  ) {
    return {
      success: false,
      paymentIntentId: resolved.intent.id,
      jobId: resolved.intent.jobId,
      error: 'Incomplete PayPal capture webhook',
      code: 'PAYPAL_WEBHOOK_CAPTURE_INVALID',
    }
  }

  const providerFeeMinor = parseProviderMoney(financials.providerFeeValue, currency)
  const netSettlementMinor = parseProviderMoney(
    financials.netSettlementValue,
    currency
  )

  const result = await finalizeProviderCapture({
    provider: 'PAYPAL',
    paymentIntentId: resolved.intent.id,
    providerOrderId: refs.orderId,
    providerCaptureId: financials.captureId,
    amountMinor,
    currency,
    providerFeeMinor,
    netSettlementMinor,
    providerStatus: financials.captureStatus || 'COMPLETED',
  })
  return {
    ...result,
    jobId: resolved.intent.jobId,
  }
}

async function markPayPalCaptureDenied(
  refs: ReturnType<typeof extractPayPalEventReferences>,
  resolved: NonNullable<Awaited<ReturnType<typeof resolveIntentForPayPalEvent>>>
) {
  await prisma.$transaction(async tx => {
    await tx.paymentIntent.updateMany({
      where: {
        id: resolved.intent.id,
        status: { in: ['CREATED', 'PENDING'] },
      },
      data: {
        status: 'FAILED',
        paymentId: refs.captureId || resolved.intent.merchantOrderId,
        gatewayResponse: JSON.stringify({
          provider: 'PAYPAL',
          eventType: refs.eventType,
          providerOrderId: refs.orderId,
          providerCaptureId: refs.captureId,
          failedAt: new Date().toISOString(),
        }),
      },
    })

    await recordJobLifecycleEvent(tx, {
      jobId: resolved.intent.jobId,
      actorId: 'system:paypal-webhook',
      actorType: 'SYSTEM',
      action: 'PAYMENT_FAILED',
      metadata: {
        paymentIntentId: resolved.intent.id,
        provider: 'PAYPAL',
        providerOrderId: refs.orderId,
        providerCaptureId: refs.captureId,
        eventType: refs.eventType,
      },
    })
  })
}

async function recordExternalPayPalRefund(
  refs: ReturnType<typeof extractPayPalEventReferences>,
  resolved: NonNullable<Awaited<ReturnType<typeof resolveIntentForPayPalEvent>>>
) {
  const resource = refs.resource
  const amountRecord = objectValue(resource?.amount)
  const currency = stringValue(amountRecord?.currency_code)?.toUpperCase() || ''
  const amountValue = stringValue(amountRecord?.value)
  const amountMinor =
    currency && amountValue
      ? parseProviderMoney(amountValue, currency)
      : null

  if (!refs.refundId || amountMinor === null || !currency) return

  await prisma.$transaction(async tx => {
    const existing = await tx.paymentProviderRefund.findFirst({
      where: {
        provider: 'PAYPAL',
        providerRefundId: refs.refundId,
      },
      select: { id: true },
    })

    if (!existing) {
      await tx.paymentProviderRefund.create({
        data: {
          paymentIntentId: resolved.intent.id,
          providerTransactionId: resolved.providerTransactionId,
          countryCode: resolved.countryCode || 'UN',
          provider: 'PAYPAL',
          providerRefundId: refs.refundId,
          amount: amountMinor,
          currency,
          status: 'COMPLETED_UNRECONCILED',
          reason: 'Provider-side refund observed by verified webhook',
          metadata: JSON.stringify({
            providerCaptureId: refs.captureId,
            eventType: refs.eventType,
          }),
        },
      })
    }

    await tx.marketplaceRiskEvent.create({
      data: {
        jobId: resolved.intent.jobId,
        actorUserId: resolved.intent.customerId,
        eventType: 'PROVIDER_REFUND_RECONCILIATION_REQUIRED',
        severity: 'HIGH',
        metadata: JSON.stringify({
          paymentIntentId: resolved.intent.id,
          provider: 'PAYPAL',
          providerRefundId: refs.refundId,
          providerCaptureId: refs.captureId,
          amountMinor: amountMinor.toString(),
          currency,
        }),
      },
    })
  })
}

async function holdEscrowForProviderDispute(
  refs: ReturnType<typeof extractPayPalEventReferences>,
  resolved: NonNullable<Awaited<ReturnType<typeof resolveIntentForPayPalEvent>>>
) {
  await prisma.$transaction(async tx => {
    await tx.jobEscrow.updateMany({
      where: {
        id: resolved.intent.escrowId,
        status: 'PROTECTED',
      },
      data: { status: 'ON_HOLD' },
    })

    await tx.marketplaceRiskEvent.create({
      data: {
        jobId: resolved.intent.jobId,
        actorUserId: resolved.intent.customerId,
        eventType: 'PAYMENT_PROVIDER_DISPUTE',
        severity: 'CRITICAL',
        metadata: JSON.stringify({
          paymentIntentId: resolved.intent.id,
          provider: 'PAYPAL',
          eventType: refs.eventType,
          providerOrderId: refs.orderId,
          providerCaptureId: refs.captureId,
        }),
      },
    })

    await recordJobLifecycleEvent(tx, {
      jobId: resolved.intent.jobId,
      actorId: 'system:paypal-webhook',
      actorType: 'SYSTEM',
      action: 'PAYMENT_PROVIDER_DISPUTE',
      metadata: {
        paymentIntentId: resolved.intent.id,
        provider: 'PAYPAL',
        eventType: refs.eventType,
      },
    })
  })
}

export async function processVerifiedPayPalWebhook(input: {
  rawBody: string
  event: RecordObject
}): Promise<{
  success: boolean
  duplicate?: boolean
  ignored?: boolean
  error?: string
  code?: string
}> {
  const refs = extractPayPalEventReferences(input.event)
  if (!refs.eventId || !refs.eventType) {
    return {
      success: false,
      error: 'PayPal webhook is missing event ID or event type',
      code: 'PAYPAL_WEBHOOK_INVALID',
    }
  }

  const resolved = await resolveIntentForPayPalEvent(refs)
  const eventRecord = await recordVerifiedProviderEvent({
    provider: 'PAYPAL',
    externalEventId: refs.eventId,
    eventType: refs.eventType,
    rawBody: input.rawBody,
    payload: input.event,
    paymentIntentId: resolved?.intent.id || null,
    providerTransactionId: resolved?.providerTransactionId || null,
    countryCode: resolved?.countryCode || null,
    eventStatus: stringValue(refs.resource?.status),
    occurredAt: refs.occurredAt,
  })

  if (!eventRecord.created) {
    return { success: true, duplicate: true }
  }
  if (!eventRecord.eventId) {
    return {
      success: false,
      error: 'Provider event persistence failed',
      code: 'PAYPAL_WEBHOOK_EVENT_STORE_FAILED',
    }
  }

  if (!resolved) {
    await markProviderEventProcessed(eventRecord.eventId, 'IGNORED')
    return { success: true, ignored: true }
  }

  try {
    if (refs.eventType === 'CHECKOUT.ORDER.APPROVED') {
      if (!refs.orderId) throw new Error('PAYPAL_WEBHOOK_ORDER_ID_MISSING')
      const captured = await captureAndFinalizePayPal({
        paymentIntentId: resolved.intent.id,
        orderId: refs.orderId,
      })
      if (!captured.success && !captured.pending) {
        throw new Error(captured.code || captured.error || 'PAYPAL_CAPTURE_FAILED')
      }
    } else if (refs.eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const finalized = await processCompletedCapture(refs, resolved)
      if (!finalized.success) {
        throw new Error(finalized.code || finalized.error || 'PAYPAL_FINALIZE_FAILED')
      }
    } else if (refs.eventType === 'PAYMENT.CAPTURE.DENIED') {
      await markPayPalCaptureDenied(refs, resolved)
    } else if (
      refs.eventType === 'PAYMENT.CAPTURE.PENDING' ||
      refs.eventType === 'CHECKOUT.PAYMENT-APPROVAL.REVERSED'
    ) {
      // The verified event is retained for reconciliation. A pending capture
      // is not treated as funded and a reversed approval cannot fulfill a job.
    } else if (refs.eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      await recordExternalPayPalRefund(refs, resolved)
    } else if (refs.eventType === 'CUSTOMER.DISPUTE.CREATED') {
      await holdEscrowForProviderDispute(refs, resolved)
    } else {
      await markProviderEventProcessed(eventRecord.eventId, 'IGNORED')
      return { success: true, ignored: true }
    }

    await markProviderEventProcessed(eventRecord.eventId, 'PROCESSED')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN'
    await markProviderEventProcessed(eventRecord.eventId, 'FAILED', {
      code: message.slice(0, 120),
      message,
    })
    return {
      success: false,
      error: message,
      code: 'PAYPAL_WEBHOOK_PROCESSING_FAILED',
    }
  }
}
