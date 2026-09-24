import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function currentWeekStartUtc(now = new Date()): Date {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  const daysSinceMonday = (start.getUTCDay() + 6) % 7
  start.setUTCDate(start.getUTCDate() - daysSinceMonday)
  return start
}

/**
 * Weekly reconciliation only.
 *
 * Commission money is already withheld atomically during escrow release.
 * This job never debits a provider/company wallet. It simply closes
 * CommissionSettlement records from prior weeks for accounting/reporting.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('[SECURITY] CRON_SECRET env var is required')
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = currentWeekStartUtc()

    const pending = await prisma.commissionSettlement.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        providerId: true,
        commissionAmount: true,
        currency: true,
        countryCode: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        cutoff: cutoff.toISOString(),
        settled: 0,
        providers: 0,
      })
    }

    const ids = pending.map(row => row.id)
    const claimed = await prisma.commissionSettlement.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { status: 'SETTLED', settledAt: new Date() },
    })

    const providerIds = new Set(pending.map(row => row.providerId))
    const totalsByCurrency: Record<string, string> = {}
    for (const row of pending) {
      const current = BigInt(totalsByCurrency[row.currency] || '0')
      totalsByCurrency[row.currency] = (current + row.commissionAmount).toString()
    }

    return NextResponse.json({
      success: true,
      cutoff: cutoff.toISOString(),
      settled: claimed.count,
      providers: providerIds.size,
      totalsMinorUnits: totalsByCurrency,
      financialMovement: false,
    })
  } catch (error) {
    console.error('[CRON] Weekly commission reconciliation failed:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
