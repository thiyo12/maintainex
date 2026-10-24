import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Payment provider retired', code: 'PAYMENT_PROVIDER_RETIRED' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
