import { hasCompanyJobManagement, isAssignedCompanyWorker } from '@/lib/domain/job-lifecycle'

export type MarketplaceDisputeParticipant = 'CUSTOMER' | 'PROVIDER' | 'COMPANY'

/** Verify present authority for a case participant, including company job scope. */
export async function resolveMarketplaceDisputeParticipant(
  db: any,
  jobId: string,
  actorId: string,
): Promise<MarketplaceDisputeParticipant | null> {
  const job = await db.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { id: true, customerId: true },
  })
  if (!job) return null
  if (job.customerId === actorId) return 'CUSTOMER'

  const quote = await db.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!quote) return null
  if (quote.providerType === 'INDIVIDUAL') {
    return quote.providerId === actorId ? 'PROVIDER' : null
  }
  if (quote.providerType !== 'COMPANY') return null

  const [manager, assignedWorker] = await Promise.all([
    hasCompanyJobManagement(db, quote.providerId, actorId),
    isAssignedCompanyWorker(db, quote.providerId, jobId, actorId, ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED']),
  ])
  return manager || assignedWorker ? 'COMPANY' : null
}
