import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

/**
 * Cash settlement is intentionally disabled until MaintainEX has a dedicated
 * accounting flow for off-platform cash, platform fees and commission
 * receivables. Treating an unfunded CASH escrow as a funded ledger balance
 * would manufacture provider wallet money.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = assertNotSuspended(user)
  if (blocked) return blocked

  return NextResponse.json({
    error: 'Cash settlement is temporarily disabled. Use a funded payment method.',
    code: 'CASH_PAYMENT_DISABLED',
  }, { status: 503 })
}
