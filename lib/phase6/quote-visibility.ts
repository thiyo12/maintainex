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

  const isCustomer = job.customerId === userId
  if (isCustomer) return { allowedQuoteIds: [], isCustomer: true }

  const allowedQuoteIds: string[] = []

  const myIndividualQuote = await client.jobQuote.findFirst({
    where: { jobId, providerId: userId, providerType: 'INDIVIDUAL' },
    select: { id: true },
  })
  if (myIndividualQuote) allowedQuoteIds.push(myIndividualQuote.id)

  if (companyId) {
    const membership = await client.teamMember.findFirst({
      where: { companyId, userId, status: 'ACTIVE' },
      select: { role: true },
    })

    if (membership) {
      const role = membership.role as CompanyRole
      if (hasCompanyPermission(role, 'quotes:read')) {
        const myCompanyQuote = await client.jobQuote.findFirst({
          where: { jobId, providerId: companyId, providerType: 'COMPANY' },
          select: { id: true },
        })
        if (myCompanyQuote) allowedQuoteIds.push(myCompanyQuote.id)
      }
    }
  }

  return { allowedQuoteIds, isCustomer: false }
}
