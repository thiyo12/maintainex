import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Legacy quick booking is disabled. Create a marketplace job through /api/mobile/v2/jobs.',
      code: 'LEGACY_BOOKING_DISABLED',
    },
    { status: 410 }
  )
}
