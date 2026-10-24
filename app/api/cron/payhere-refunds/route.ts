import { NextResponse } from 'next/server'

/** Retired gateway refund polling is disabled. Historical rows remain stored. */
export async function GET() {
  return NextResponse.json(
    { error: 'Payment provider retired', code: 'PAYMENT_PROVIDER_RETIRED' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST() {
  return NextResponse.json(
    { error: 'Payment provider retired', code: 'PAYMENT_PROVIDER_RETIRED' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
