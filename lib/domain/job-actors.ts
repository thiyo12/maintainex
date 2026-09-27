import { prisma } from '@/lib/prisma'
import type { ActorType } from '@/lib/domain/job-lifecycle'

export async function resolveProviderActor(jobId: string, userId: string): Promise<ActorType | null> {
  const acceptedQuote = await prisma.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!acceptedQuote) return null

  if (acceptedQuote.providerType === 'INDIVIDUAL' && acceptedQuote.providerId === userId) {
    return 'PROVIDER'
  }

  if (acceptedQuote.providerType === 'COMPANY') {
    const membership = await prisma.teamMember.findFirst({
      where: { companyId: acceptedQuote.providerId, userId, status: 'ACTIVE' },
      select: { id: true },
    })
    if (membership) return 'COMPANY'
  }

  return null
}
