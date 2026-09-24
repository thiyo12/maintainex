import { NextRequest, NextResponse } from 'next/server'
import { reconcilePreviousWeekCommissions } from '@/lib/commission-weekly'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await reconcilePreviousWeekCommissions()
    return NextResponse.json({
      success: true,
      ...result,
      weekStart: result.weekStart.toISOString(),
      weekEnd: result.weekEnd.toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Weekly commission reconciliation failed:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
