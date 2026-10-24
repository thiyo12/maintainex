import { NextResponse } from 'next/server'

/** PayPal is retired; no provider events are accepted or processed. */
export async function POST() {
  return NextResponse.json(
    { error: 'Payment provider retired', code: 'PAYMENT_PROVIDER_RETIRED' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
