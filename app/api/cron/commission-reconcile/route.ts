import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function startOfCurrentUtcWeek(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const mondayOffset = (start.getUTCDay() + 6) % 7
  start.setUTCDate(start.getUTCDate() - mondayOffset)
  return start
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw new Error('[SECURITY] CRON_SECRET env var is required')
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = startOfCurrentUtcWeek()
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
      return NextResponse.json({
        success: true,
        cutoff: cutoff.toISOString(),
        settledCount: 0,
        totals: {},
      })
    }

    const ids = pending.map(item => item.id)
    const claimed = await prisma.commissionSettlement.updateMany({
      where: {
        id: { in: ids },
        status: 'PENDING',
      },
      data: {
        status: 'SETTLED',
        settledAt: new Date(),
      },
    })

    const totals: Record<string, string> = {}
    for (const item of pending) {
      const current = BigInt(totals[item.currency] || '0')
      totals[item.currency] = (current + item.commissionAmount).toString()
    }

    return NextResponse.json({
      success: true,
      cutoff: cutoff.toISOString(),
      settledCount: claimed.count,
      totals,
      note: 'Commission was already withheld atomically at job payment release; this run is reconciliation only.',
    })
  } catch (error) {
    console.error('[CRON] Weekly commission reconciliation failed:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
