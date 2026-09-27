import { prisma } from '@/lib/prisma'
import { bigIntToSafeNumber } from '@/lib/money'
import { Prisma } from '@prisma/client'

export async function resolvePayoutIdentity(providerId: string, providerType: string) {
  if (providerType === 'COMPANY') {
    const company = await prisma.companyProfile.findUnique({
      where: { id: providerId },
      select: { id: true, userId: true, commissionRate: true },
    })
    if (!company) throw new Error('Company provider not found')
    return {
      providerEntityId: company.id,
      payoutUserId: company.userId,
      commissionRate: company.commissionRate,
    }
  }

  const user = await prisma.user.findUnique({ where: { id: providerId }, select: { id: true } })
  if (!user) throw new Error('Provider user not found')
  return { providerEntityId: providerId, payoutUserId: providerId, commissionRate: null as number | null }
}

export function getUtcWeekBounds(at: Date = new Date()) {
  const day = at.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  const weekStart = new Date(Date.UTC(
    at.getUTCFullYear(),
    at.getUTCMonth(),
    at.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0
  ))
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  weekEnd.setUTCHours(23, 59, 59, 999)
  const dueAt = new Date(weekEnd)
  dueAt.setUTCDate(dueAt.getUTCDate() + 7)
  return { weekStart, weekEnd, dueAt }
}

export async function recordWeeklySettlement(
  tx: Prisma.TransactionClient,
  input: {
    providerId: string
    providerType: string
    jobAmountCents: bigint
    commissionRate: number
    commissionCents: bigint
    currency: string
    countryCode: string
    completedAt?: Date
  }
) {
  const { weekStart, weekEnd, dueAt } = getUtcWeekBounds(input.completedAt)
  const totalEarnings = bigIntToSafeNumber(input.jobAmountCents) / 100
  const commissionOwed = bigIntToSafeNumber(input.commissionCents) / 100
  const providerType = input.providerType === 'COMPANY' ? 'COMPANY' : 'TASKER'

  await tx.weeklySettlement.upsert({
    where: { providerId_weekStart: { providerId: input.providerId, weekStart } },
    create: {
      providerId: input.providerId,
      providerType,
      weekStart,
      weekEnd,
      totalEarnings,
      commissionRate: input.commissionRate,
      commissionOwed,
      commissionPaid: false,
      dueAt,
      status: 'PENDING',
      currency: input.currency,
      countryCode: input.countryCode,
    },
    update: {
      totalEarnings: { increment: totalEarnings },
      commissionOwed: { increment: commissionOwed },
      commissionRate: input.commissionRate,
      currency: input.currency,
      countryCode: input.countryCode,
    },
  })
}
