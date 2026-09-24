import { NextRequest, NextResponse } from 'next/server'
import { reconcilePriorWeekCommissions } from '@/lib/commission-reconcile'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw new Error('[SECURITY] CRON_SECRET env var is required')
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await reconcilePriorWeekCommissions()
    return NextResponse.json({
      success: true,
      cutoff: result.cutoff.toISOString(),
      settledCount: result.settledCount,
      totals: result.totals,
      note: 'Commission was withheld atomically at payment release; this weekly run reconciles already-withheld settlement records.',
    })
  } catch (error) {
    console.error('[CRON] Weekly commission reconciliation failed:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
