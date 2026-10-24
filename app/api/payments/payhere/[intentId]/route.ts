import { NextRequest, NextResponse } from 'next/server'

/** Existing hosted-checkout URLs remain safely closed with Gone. */
export async function GET(
  _request: NextRequest,
  _context: { params: Promise<{ intentId: string }> },
) {
  return NextResponse.json(
    { error: 'Payment provider retired', code: 'PAYMENT_PROVIDER_RETIRED' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
