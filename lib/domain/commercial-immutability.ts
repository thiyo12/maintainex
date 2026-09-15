import { PrismaClient } from '@prisma/client'

/**
 * Checks that a JobQuote has not been superseded and can be mutated.
 * Prevents modification of finalized/approved quotes.
 */
export async function assertQuoteMutable(
  client: PrismaClient,
  quoteId: string,
): Promise<{ mutable: boolean; reason?: string }> {
  const quote = await client.jobQuote.findUnique({
    where: { id: quoteId },
    select: { status: true, parentQuoteId: true },
  })
  if (!quote) return { mutable: false, reason: 'QUOTE_NOT_FOUND' }
  if (quote.status === 'ACCEPTED') return { mutable: false, reason: 'QUOTE_ACCEPTED' }
  if (quote.status === 'SUPERSEDED') return { mutable: false, reason: 'QUOTE_SUPERSEDED' }
  if (quote.parentQuoteId) return { mutable: false, reason: 'QUOTE_IS_REVISION' }
  return { mutable: true }
}

/**
 * Checks that a JobChangeOrder can be mutated.
 * Only DRAFT and SUBMITTED change orders can be modified.
 */
export async function assertChangeOrderMutable(
  client: PrismaClient,
  changeOrderId: string,
): Promise<{ mutable: boolean; reason?: string }> {
  const co = await client.jobChangeOrder.findUnique({
    where: { id: changeOrderId },
    select: { status: true },
  })
  if (!co) return { mutable: false, reason: 'CHANGE_ORDER_NOT_FOUND' }
  if (co.status === 'APPROVED') return { mutable: false, reason: 'CHANGE_ORDER_APPROVED' }
  if (co.status === 'REJECTED') return { mutable: false, reason: 'CHANGE_ORDER_REJECTED' }
  if (co.status === 'CANCELLED') return { mutable: false, reason: 'CHANGE_ORDER_CANCELLED' }
  return { mutable: true }
}

/**
 * Checks that a MarketplaceJob's financial fields can be mutated.
 * Prevents double-spending or modifying settled jobs.
 * Checks both job status and the associated JobEscrow settlement status.
 */
export async function assertJobFinanciallyMutable(
  client: PrismaClient,
  jobId: string,
): Promise<{ mutable: boolean; reason?: string }> {
  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  })
  if (!job) return { mutable: false, reason: 'JOB_NOT_FOUND' }
  if (job.status === 'COMPLETED') return { mutable: false, reason: 'JOB_COMPLETED' }
  if (job.status === 'CANCELLED') return { mutable: false, reason: 'JOB_CANCELLED' }

  const settledEscrow = await client.jobEscrow.findFirst({
    where: {
      jobId,
      status: { in: ['RELEASED', 'REFUNDED'] },
    },
    select: { id: true },
  })
  if (settledEscrow) return { mutable: false, reason: 'PAYMENT_SETTLED' }

  return { mutable: true }
}
