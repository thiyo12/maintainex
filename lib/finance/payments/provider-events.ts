import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizePaymentProvider } from '@/lib/finance/payments/provider-registry'

const REDACTED = '[REDACTED]'
const SENSITIVE_KEY = /(secret|token|password|authorization|signature|client[_-]?secret|access[_-]?token|refresh[_-]?token|email_address|phone|payer[_-]?id)/i

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 10) return '[TRUNCATED]'

  if (Array.isArray(value)) {
    return value.slice(0, 200).map(item => sanitizeValue(item, depth + 1))
  }

  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 4000) {
      return `${value.slice(0, 4000)}…`
    }
    return value
  }

  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 300)) {
    output[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : sanitizeValue(child, depth + 1)
  }
  return output
}

export function sanitizeProviderEventPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(payload) as Record<string, unknown>
}

export function hashProviderEventPayload(rawBody: string): string {
  return crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex')
}

export async function recordVerifiedProviderEvent(input: {
  provider: string
  externalEventId: string
  eventType: string
  rawBody: string
  payload: Record<string, unknown>
  paymentIntentId?: string | null
  providerTransactionId?: string | null
  countryCode?: string | null
  eventStatus?: string | null
  occurredAt?: Date | null
}): Promise<{ created: boolean; eventId: string | null }> {
  const provider = normalizePaymentProvider(input.provider)
  if (!provider) throw new Error('Unsupported payment provider')

  const externalEventId = input.externalEventId.trim()
  const eventType = input.eventType.trim()
  if (!externalEventId || externalEventId.length > 255) {
    throw new Error('Invalid provider event ID')
  }
  if (!eventType || eventType.length > 255) {
    throw new Error('Invalid provider event type')
  }

  const payloadHash = hashProviderEventPayload(input.rawBody)
  const sanitized = sanitizeProviderEventPayload(input.payload)

  try {
    const event = await prisma.paymentProviderEvent.create({
      data: {
        provider,
        externalEventId,
        paymentIntentId: input.paymentIntentId || null,
        providerTransactionId: input.providerTransactionId || null,
        countryCode: input.countryCode?.trim().toUpperCase() || null,
        eventType,
        eventStatus: input.eventStatus || null,
        payloadHash,
        payload: JSON.stringify(sanitized),
        signatureVerified: true,
        processingStatus: 'RECEIVED',
        occurredAt: input.occurredAt || null,
      },
      select: { id: true },
    })

    return { created: true, eventId: event.id }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.paymentProviderEvent.findFirst({
        where: { provider, externalEventId },
        select: { id: true, payloadHash: true },
      })
      if (existing && existing.payloadHash !== payloadHash) {
        throw new Error('Provider event replay payload mismatch')
      }
      return { created: false, eventId: existing?.id || null }
    }
    throw error
  }
}

export async function markProviderEventProcessed(
  eventId: string,
  status: 'PROCESSED' | 'IGNORED' | 'FAILED',
  error?: { code?: string; message?: string }
): Promise<void> {
  await prisma.paymentProviderEvent.updateMany({
    where: {
      id: eventId,
      processingStatus: 'RECEIVED',
    },
    data: {
      processingStatus: status,
      processedAt: new Date(),
      errorCode: error?.code?.slice(0, 120) || null,
      errorMessage: error?.message?.slice(0, 1000) || null,
    },
  })
}
