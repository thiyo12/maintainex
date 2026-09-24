import { prisma } from '@/lib/prisma'

export function startOfCurrentUtcWeek(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const mondayOffset = (start.getUTCDay() + 6) % 7
  start.setUTCDate(start.getUTCDate() - mondayOffset)
  return start
}

export async function reconcilePriorWeekCommissions(now = new Date()) {
  const cutoff = startOfCurrentUtcWeek(now)
  const pending = await prisma.commissionSettlement.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      commissionAmount: true,
      currency: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 5000,
  })

  if (pending.length === 0) {
    return { cutoff, settledCount: 0, totals: {} as Record<string, string> }
  }

  const claimed = await prisma.commissionSettlement.updateMany({
    where: {
      id: { in: pending.map(item => item.id) },
      status: 'PENDING',
    },
    data: {
      status: 'SETTLED',
      settledAt: now,
    },
  })

  const totals: Record<string, string> = {}
  for (const item of pending) {
    const current = BigInt(totals[item.currency] || '0')
    totals[item.currency] = (current + item.commissionAmount).toString()
  }

  return { cutoff, settledCount: claimed.count, totals }
}
