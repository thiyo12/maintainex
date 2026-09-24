import { prisma } from '@/lib/prisma'

function previousWeekUtc(reference = new Date()) {
  const day = reference.getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  const thisMonday = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate() - daysSinceMonday,
  ))
  const weekEndExclusive = thisMonday
  const weekStart = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekEnd = new Date(weekEndExclusive.getTime() - 1)
  return { weekStart, weekEnd, weekEndExclusive }
}

export async function reconcilePreviousWeekCommissions(reference = new Date()) {
  const { weekStart, weekEnd, weekEndExclusive } = previousWeekUtc(reference)
  const rows = await prisma.commissionSettlement.findMany({
    where: {
      status: 'PENDING',
      createdAt: { gte: weekStart, lt: weekEndExclusive },
    },
    orderBy: { createdAt: 'asc' },
  })

  const grouped = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = `${row.providerId}:${row.currency}:${row.countryCode}`
    const list = grouped.get(key) || []
    list.push(row)
    grouped.set(key, list)
  }

  let providers = 0
  let settlements = 0
  for (const group of grouped.values()) {
    if (!group.length) continue
    const providerId = group[0].providerId
    const company = await prisma.companyProfile.findUnique({
      where: { userId: providerId },
      select: { id: true },
    })
    const totalJobCents = group.reduce((sum, row) => sum + row.jobAmount, 0n)
    const totalCommissionCents = group.reduce((sum, row) => sum + row.commissionAmount, 0n)
    const weightedRate = totalJobCents > 0n
      ? Number(totalCommissionCents * 10000n / totalJobCents) / 100
      : 0
    const totalEarnings = Number(totalJobCents) / 100
    const commissionOwed = Number(totalCommissionCents) / 100

    await prisma.$transaction(async tx => {
      await tx.weeklySettlement.upsert({
        where: { providerId_weekStart: { providerId, weekStart } },
        create: {
          providerId,
          providerType: company ? 'COMPANY' : 'TASKER',
          weekStart,
          weekEnd,
          totalEarnings,
          commissionRate: weightedRate,
          commissionOwed,
          commissionPaid: true,
          paidAt: new Date(),
          dueAt: weekEndExclusive,
          status: 'PAID',
          currency: group[0].currency,
          countryCode: group[0].countryCode,
          notes: 'Reconciled from commissions already withheld during escrow release. No additional provider debit.',
        },
        update: {
          totalEarnings,
          commissionRate: weightedRate,
          commissionOwed,
          commissionPaid: true,
          paidAt: new Date(),
          status: 'PAID',
          notes: 'Reconciled from commissions already withheld during escrow release. No additional provider debit.',
        },
      })

      await tx.commissionSettlement.updateMany({
        where: { id: { in: group.map(row => row.id) }, status: 'PENDING' },
        data: { status: 'SETTLED', settledAt: new Date() },
      })
    })

    providers += 1
    settlements += group.length
  }

  return { weekStart, weekEnd, providers, settlements }
}
