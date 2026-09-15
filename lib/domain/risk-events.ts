import { PrismaClient, Prisma } from '@prisma/client'

export type RiskEventType =
  | 'CONTACT_SHARE_ATTEMPT'
  | 'OFF_PLATFORM_PAYMENT_LANGUAGE'
  | 'PREMATURE_CONTACT_ACCESS'
  | 'REPEATED_CANCELLATION_AFTER_MATCH'
  | 'ABNORMAL_PRICE_ESCALATION'

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface CreateRiskEventInput {
  jobId?: string
  actorUserId: string
  eventType: RiskEventType
  severity?: RiskSeverity
  metadata?: Record<string, unknown>
}

/**
 * Create a risk event for anti-bypass monitoring.
 * Risk events are signals, NOT proof. They do not trigger automatic punishment.
 */
export async function createRiskEvent(
  client: PrismaClient | Prisma.TransactionClient,
  input: CreateRiskEventInput,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const event = await client.marketplaceRiskEvent.create({
    data: {
      jobId: input.jobId ?? null,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      severity: input.severity ?? 'LOW',
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  return { success: true, eventId: event.id }
}

/**
 * Check if a message contains contact-sharing patterns.
 * Returns the risk event type if detected, null otherwise.
 * Does NOT block the message — only flags for review.
 */
export function detectContactSharePattern(message: string): RiskEventType | null {
  const phonePattern = /(\+?\d{1,4}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4})/
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  const whatsappPattern = /whatsapp|wa\.me|chat\.whatsapp/i
  const telegramPattern = /t\.me|telegram/i
  const signalPattern = /signal\.me|signal\s+app|\bon\s+signal\b/i
  const socialPattern = /facebook\.com|instagram\.com|linkedin\.com/i

  if (whatsappPattern.test(message) || telegramPattern.test(message) || signalPattern.test(message)) {
    return 'CONTACT_SHARE_ATTEMPT'
  }
  if (emailPattern.test(message)) {
    return 'CONTACT_SHARE_ATTEMPT'
  }
  if (phonePattern.test(message)) {
    return 'CONTACT_SHARE_ATTEMPT'
  }
  if (socialPattern.test(message)) {
    return 'CONTACT_SHARE_ATTEMPT'
  }

  return null
}

/**
 * Check if a message contains off-platform payment language.
 */
export function detectOffPlatformPayment(message: string): RiskEventType | null {
  const paymentPatterns = /pay\s*(me\s*)?direct|bank\s*transfer\s*(outside|bypass)|cash\s*(outside|bypass)|cancel\s+(the\s+)?(job|booking|order)?\s*(and\s*)?pay|venmo|cashapp|paypal|mobile\s*pay|western\s*union/i

  if (paymentPatterns.test(message)) {
    return 'OFF_PLATFORM_PAYMENT_LANGUAGE'
  }

  return null
}

/**
 * Calculate price escalation signal for a job.
 * Non-punitive: these are trust signals for later analysis.
 */
export async function calculatePriceEscalationSignals(
  client: PrismaClient | Prisma.TransactionClient,
  jobId: string,
): Promise<{
  initialToFinalIncreaseBps: number
  changeOrderCount: number
  changeOrderValueCents: bigint
} | null> {
  const job = await client.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job || !job.approvedQuoteId) return null

  const approvedQuote = await client.jobQuote.findUnique({ where: { id: job.approvedQuoteId } })
  if (!approvedQuote) return null

  // Find the first quote on this job (initial quote)
  const firstQuote = await client.jobQuote.findFirst({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
  })

  const initialAmount = firstQuote?.price ?? approvedQuote.price
  const finalAmount = job.finalAuthorizedAmountCents ?? approvedQuote.price

  const initialToFinalIncreaseBps = initialAmount > 0n
    ? Number(((finalAmount - initialAmount) * 10000n) / initialAmount)
    : 0

  const approvedOrders = await client.jobChangeOrder.findMany({
    where: { jobId, status: 'APPROVED' },
  })

  return {
    initialToFinalIncreaseBps,
    changeOrderCount: approvedOrders.length,
    changeOrderValueCents: approvedOrders.reduce((sum, co) => sum + co.amountDeltaCents, 0n),
  }
}

/**
 * Get the auditable commercial history for a job.
 */
export async function getCommercialHistory(
  client: PrismaClient | Prisma.TransactionClient,
  jobId: string,
): Promise<{
  initialQuote: { id: string; amountCents: bigint; createdAt: Date } | null
  approvedQuote: { id: string; amountCents: bigint; version: number; approvedAt: Date | null } | null
  changeOrders: Array<{
    id: string
    amountDeltaCents: bigint
    reason: string
    status: string
    submittedAt: Date | null
    decisionAt: Date | null
  }>
  finalAuthorizedAmountCents: bigint | null
} | null> {
  const job = await client.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return null

  // Initial quote (first quote on the job)
  const initialQuote = await client.jobQuote.findFirst({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, price: true, createdAt: true },
  })

  // Approved quote
  let approvedQuote = null
  if (job.approvedQuoteId) {
    const aq = await client.jobQuote.findUnique({
      where: { id: job.approvedQuoteId },
      select: { id: true, price: true, revisionNumber: true, createdAt: true },
    })
    if (aq) {
      approvedQuote = {
        id: aq.id,
        amountCents: aq.price,
        version: aq.revisionNumber,
        approvedAt: aq.createdAt,
      }
    }
  }

  // Change orders
  const changeOrders = await client.jobChangeOrder.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      amountDeltaCents: true,
      reason: true,
      status: true,
      submittedAt: true,
      customerDecisionAt: true,
    },
  })

  return {
    initialQuote: initialQuote ? { id: initialQuote.id, amountCents: initialQuote.price, createdAt: initialQuote.createdAt } : null,
    approvedQuote,
    changeOrders: changeOrders.map(co => ({
      id: co.id,
      amountDeltaCents: co.amountDeltaCents,
      reason: co.reason,
      status: co.status,
      submittedAt: co.submittedAt,
      decisionAt: co.customerDecisionAt,
    })),
    finalAuthorizedAmountCents: job.finalAuthorizedAmountCents,
  }
}
