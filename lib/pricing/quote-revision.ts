import { PrismaClient } from '@prisma/client'
import { lockAndAssertProviderAvailable } from '@/lib/domain/provider-availability'

/**
 * Create a new revision of an existing quote.
 * The original quote becomes SUPERSEDED, the new one starts as PENDING.
 * Once a quote is ACCEPTED, it cannot be revised — requires customer approval flow.
 */
export async function createQuoteRevision(
  client: PrismaClient,
  params: {
    originalQuoteId: string
    providerId: string
    price: bigint
    estimatedCompletionTime: string
    message?: string
    attachments?: string
    revisionReason: string
    currency?: string
    subtotalCents?: bigint
    taxCents?: bigint
    totalCents?: bigint
    benchmarkClassification?: string
    benchmarkId?: string
  },
): Promise<{ success: boolean; newQuoteId?: string; error?: string }> {
  try {
    return await client.$transaction(async (tx) => {
      const original = await tx.jobQuote.findUnique({
        where: { id: params.originalQuoteId },
      })

      if (!original) return { success: false, error: 'Original quote not found' }
      if (original.providerId !== params.providerId) return { success: false, error: 'Not your quote' }
      if (original.status === 'ACCEPTED') return { success: false, error: 'Cannot revise an accepted quote' }
      if (original.status === 'REJECTED') return { success: false, error: 'Cannot revise a rejected quote' }
      if (original.status === 'WITHDRAWN') return { success: false, error: 'Cannot revise a withdrawn quote' }
      if (original.status === 'SUPERSEDED') return { success: false, error: 'Cannot revise a superseded quote' }
      if (original.status !== 'PENDING') return { success: false, error: `Cannot revise quote in ${original.status} state` }
      if (original.providerType !== 'INDIVIDUAL' && original.providerType !== 'COMPANY') {
        return { success: false, error: 'Provider is no longer available' }
      }

      await lockAndAssertProviderAvailable(
        tx,
        original.providerType,
        original.providerId,
        'Provider is no longer available',
      )

      const lockedJobs = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status
        FROM "MarketplaceJob"
        WHERE id = ${original.jobId}
        FOR UPDATE
      `
      const lockedJob = lockedJobs[0]
      if (!lockedJob) return { success: false, error: 'Job not found' }
      if (lockedJob.status !== 'OPEN') {
        return { success: false, error: 'Quote revisions are only allowed while the job is open' }
      }

      const claimed = await tx.jobQuote.updateMany({
        where: {
          id: params.originalQuoteId,
          providerId: params.providerId,
          status: 'PENDING',
        },
        data: { status: 'SUPERSEDED' },
      })
      if (claimed.count !== 1) {
        return { success: false, error: 'Quote changed while revision was being submitted' }
      }

      const newQuote = await tx.jobQuote.create({
        data: {
          jobId: original.jobId,
          providerId: params.providerId,
          providerType: original.providerType,
          price: params.price,
          actorUserId: original.actorUserId,
          actorRole: original.actorRole,
          estimatedCompletionTime: params.estimatedCompletionTime,
          message: params.message ?? original.message,
          attachments: params.attachments ?? original.attachments,
          status: 'PENDING',
          currency: params.currency ?? original.currency,
          subtotalCents: params.subtotalCents ?? null,
          taxCents: params.taxCents ?? null,
          totalCents: params.totalCents ?? null,
          benchmarkClassification: params.benchmarkClassification ?? null,
          benchmarkId: params.benchmarkId ?? null,
          revisionNumber: original.revisionNumber + 1,
          parentQuoteId: params.originalQuoteId,
          revisionReason: params.revisionReason,
        },
      })

      return { success: true, newQuoteId: newQuote.id }
    })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return { success: false, error: 'A quote revision is already active for this job' }
    }
    throw error
  }
}

/**
 * Get the full revision history for a quote chain.
 * Traverses parentQuoteId links to find the original.
 */
export async function getQuoteRevisionHistory(
  client: PrismaClient,
  quoteId: string,
): Promise<Array<{ id: string; revisionNumber: number; status: string; price: bigint; createdAt: Date; revisionReason: string | null }>> {
  // Find the root quote (traverse parent links)
  const initial = await client.jobQuote.findUnique({ where: { id: quoteId } })
  if (!initial) return []

  let rootId: string = initial.id
  let currentParentId: string | null = initial.parentQuoteId

  while (currentParentId) {
    const parent = await client.jobQuote.findUnique({ where: { id: currentParentId } })
    if (!parent) break
    rootId = parent.id
    currentParentId = parent.parentQuoteId
  }

  // Now walk forward through the chain
  const history: Array<{ id: string; revisionNumber: number; status: string; price: bigint; createdAt: Date; revisionReason: string | null }> = []
  let chainId: string | null = rootId

  while (chainId) {
    const quote = await client.jobQuote.findUnique({ where: { id: chainId } })
    if (!quote) break
    history.push({
      id: quote.id,
      revisionNumber: quote.revisionNumber,
      status: quote.status,
      price: quote.price,
      createdAt: quote.createdAt,
      revisionReason: quote.revisionReason,
    })
    const childResult: { id: string } | null = await client.jobQuote.findFirst({ where: { parentQuoteId: chainId } })
    chainId = childResult?.id ?? null
  }

  return history
}

/**
 * Check if a quote is the latest revision in its chain.
 */
export async function isLatestRevision(
  client: PrismaClient,
  quoteId: string,
): Promise<boolean> {
  const quote = await client.jobQuote.findUnique({ where: { id: quoteId } })
  if (!quote) return false

  const newer = await client.jobQuote.findFirst({
    where: { parentQuoteId: quoteId },
  })
  return !newer
}
