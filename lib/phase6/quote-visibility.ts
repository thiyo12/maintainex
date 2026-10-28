import { PrismaClient, Prisma } from '@prisma/client'
import { hasCompanyPermission, CompanyRole } from './rbac'

export interface QuoteVisibilityParams {
  userId: string
  jobId: string
  companyId?: string | null
}

export interface QuoteVisibilityResult {
  allowedQuoteIds: string[]
  isCustomer: boolean
}

export async function resolveQuoteVisibility(
  client: PrismaClient | Prisma.TransactionClient,
  params: QuoteVisibilityParams
): Promise<QuoteVisibilityResult> {
  const { userId, jobId, companyId } = params

  const job = await client.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { customerId: true },
  })
  if (!job) return { allowedQuoteIds: [], isCustomer: false }

  if (job.customerId === userId) {
    return { allowedQuoteIds: [], isCustomer: true }
  }

  if (companyId) {
    const membership = await client.teamMember.findFirst({
      where: { companyId, userId, status: 'ACTIVE' },
      select: { role: true },
    })

    if (!membership) {
      return { allowedQuoteIds: [], isCustomer: false }
    }

    const role = membership.role as CompanyRole
    if (!hasCompanyPermission(role, 'quotes:read')) {
      return { allowedQuoteIds: [], isCustomer: false }
    }

    // Generic quotes:read is historically included in the WORKER role, but
    // must never reveal unrelated company customer/price information.
    // Only the worker assigned to this exact job can read its company quote.
    if (role === 'WORKER') {
      const assigned = await client.companyJobAssignment.findFirst({
        where: {
          jobId,
          companyId,
          workerUserId: userId,
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
        },
        select: { id: true },
      })
      if (!assigned) return { allowedQuoteIds: [], isCustomer: false }
    }

    const companyQuote = await client.jobQuote.findFirst({
      where: { jobId, providerId: companyId, providerType: 'COMPANY' },
      select: { id: true },
    })

    return {
      allowedQuoteIds: companyQuote ? [companyQuote.id] : [],
      isCustomer: false,
    }
  }

  const individualQuote = await client.jobQuote.findFirst({
    where: { jobId, providerId: userId, providerType: 'INDIVIDUAL' },
    select: { id: true },
  })

  return {
    allowedQuoteIds: individualQuote ? [individualQuote.id] : [],
    isCustomer: false,
  }
}
