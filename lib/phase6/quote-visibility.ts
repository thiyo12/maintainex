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
  if (individualQuote) {
    return {
      allowedQuoteIds: [individualQuote.id],
      isCustomer: false,
    }
  }

  // Company members should not have to know/pass the CompanyProfile id just to
  // read their own company's quote. Resolve active memberships automatically.
  const memberships = await client.teamMember.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { companyId: true, role: true },
  })
  const readableCompanyIds = memberships
    .filter(member => hasCompanyPermission(member.role as CompanyRole, 'quotes:read'))
    .map(member => member.companyId)

  if (readableCompanyIds.length === 0) {
    return { allowedQuoteIds: [], isCustomer: false }
  }

  const companyQuotes = await client.jobQuote.findMany({
    where: {
      jobId,
      providerType: 'COMPANY',
      providerId: { in: readableCompanyIds },
    },
    select: { id: true },
  })

  return {
    allowedQuoteIds: companyQuotes.map(quote => quote.id),
    isCustomer: false,
  }
}
