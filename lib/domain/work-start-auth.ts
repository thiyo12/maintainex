import { PrismaClient } from '@prisma/client'

/**
 * Work-start authorization gate.
 *
 * Ensures all prerequisites are met before a provider can start work on a job:
 * 1. The caller is the assigned provider (has the accepted quote)
 * 2. The job is in QUOTE_ACCEPTED status
 * 3. If requiresInspection, a completed + customer-verified inspection exists
 * 4. An accepted quote exists (job has approvedQuoteId or a JobQuote with ACCEPTED status)
 */
export async function checkWorkStartAuthorization(
  client: PrismaClient,
  jobId: string,
  providerId: string,
): Promise<{
  authorized: boolean
  reason?: string
  missingRequirements?: string[]
}> {
  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      requiresInspection: true,
      approvedQuoteId: true,
      status: true,
      customerId: true,
    },
  })

  if (!job) {
    return { authorized: false, reason: 'JOB_NOT_FOUND' }
  }

  const acceptedQuote = await client.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { id: true, providerId: true, providerType: true },
  })

  if (!acceptedQuote) {
    return { authorized: false, reason: 'NO_ACCEPTED_QUOTE' }
  }

  const isProvider =
    acceptedQuote.providerType === 'INDIVIDUAL' &&
    acceptedQuote.providerId === providerId

  const isCompanyMember =
    acceptedQuote.providerType === 'COMPANY' &&
    (await client.teamMember.findFirst({
      where: {
        companyId: acceptedQuote.providerId,
        userId: providerId,
        status: 'ACTIVE',
      },
      select: { id: true },
    }))

  if (!isProvider && !isCompanyMember) {
    return { authorized: false, reason: 'NOT_PROVIDER' }
  }

  if (job.status !== 'QUOTE_ACCEPTED') {
    return {
      authorized: false,
      reason: 'INVALID_JOB_STATUS',
      missingRequirements: [`job_status_is_${job.status}_expected_QUOTE_ACCEPTED`],
    }
  }

  const missingRequirements: string[] = []

  if (job.requiresInspection) {
    const inspection = await client.jobInspection.findFirst({
      where: {
        jobId,
        status: 'COMPLETED',
        verifiedByCustomer: true,
      },
    })

    if (!inspection) {
      missingRequirements.push('inspection_not_completed_or_verified')
    }
  }

  const hasApprovedQuote =
    job.approvedQuoteId !== null || acceptedQuote.id !== null

  if (!hasApprovedQuote) {
    missingRequirements.push('no_accepted_quote')
  }

  if (missingRequirements.length === 0) {
    return { authorized: true }
  }

  return {
    authorized: false,
    reason: 'PREREQUISITES_NOT_MET',
    missingRequirements,
  }
}
