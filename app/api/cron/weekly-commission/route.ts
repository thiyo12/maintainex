import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function startOfUtcWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function weekEnd(weekStart: Date) {
  const end = new Date(weekStart)
  end.setUTCDate(end.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const currentWeekStart = startOfUtcWeek(new Date())
    const pending = await prisma.commissionSettlement.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: currentWeekStart },
      },
      orderBy: { createdAt: 'asc' },
    })

    const groups = new Map<string, typeof pending>()
    for (const settlement of pending) {
      const settlementWeek = startOfUtcWeek(settlement.createdAt)
      const key = `${settlement.providerId}:${settlementWeek.toISOString()}`
      const list = groups.get(key) || []
      list.push(settlement)
      groups.set(key, list)
    }

    let reconciledSettlements = 0
    let weeklyRows = 0
    const skipped: Array<{ providerId: string; reason: string }> = []

    for (const settlements of groups.values()) {
      const first = settlements[0]
      const currencies = [...new Set(settlements.map(item => item.currency))]
      const countries = [...new Set(settlements.map(item => item.countryCode))]
      if (currencies.length !== 1 || countries.length !== 1) {
        skipped.push({
          providerId: first.providerId,
          reason: 'Mixed currency/country in one provider week requires manual finance review',
        })
        continue
      }

      const weekStart = startOfUtcWeek(first.createdAt)
      const end = weekEnd(weekStart)
      const dueAt = new Date(end)
      dueAt.setUTCDate(dueAt.getUTCDate() + 7)

      const totalJobCents = settlements.reduce((sum, item) => sum + item.jobAmount, 0n)
      const commissionCents = settlements.reduce((sum, item) => sum + item.commissionAmount, 0n)
      const totalEarnings = Number(totalJobCents) / 100
      const commissionOwed = Number(commissionCents) / 100
      const effectiveRate = totalJobCents > 0n
        ? Number((commissionCents * 10_000n) / totalJobCents) / 100
        : 0

      const company = await prisma.companyProfile.findUnique({
        where: { userId: first.providerId },
        select: { id: true },
      })
      const providerType = company ? 'COMPANY' : 'TASKER'

      await prisma.$transaction(async tx => {
        await tx.weeklySettlement.upsert({
          where: {
            providerId_weekStart: {
              providerId: first.providerId,
              weekStart,
            },
          },
          create: {
            providerId: first.providerId,
            providerType,
            weekStart,
            weekEnd: end,
            totalEarnings,
            commissionRate: effectiveRate,
            commissionOwed,
            commissionPaid: true,
            paidAt: new Date(),
            dueAt,
            status: 'PAID',
            currency: first.currency,
            countryCode: first.countryCode,
            notes: 'Reconciled from commission already withheld during escrow release. No second wallet debit.',
          },
          update: {
            totalEarnings,
            commissionRate: effectiveRate,
            commissionOwed,
            commissionPaid: true,
            paidAt: new Date(),
            dueAt,
            status: 'PAID',
            currency: first.currency,
            countryCode: first.countryCode,
            notes: 'Reconciled from commission already withheld during escrow release. No second wallet debit.',
          },
        })

        await tx.commissionSettlement.updateMany({
          where: {
            id: { in: settlements.map(item => item.id) },
            status: 'PENDING',
          },
          data: {
            status: 'SETTLED',
            settledAt: new Date(),
          },
        })
      })

      weeklyRows += 1
      reconciledSettlements += settlements.length
    }

    return NextResponse.json({
      success: true,
      currentWeekStart: currentWeekStart.toISOString(),
      pendingFound: pending.length,
      reconciledSettlements,
      weeklyRows,
      skipped,
      note: 'Commission is withheld per completed job; this weekly job only reconciles settlement records.',
    })
  } catch (error) {
    console.error('[CRON] Weekly commission reconciliation error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
