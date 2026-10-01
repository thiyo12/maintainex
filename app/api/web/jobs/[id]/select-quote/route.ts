import { NextRequest, NextResponse } from 'next/server'
import { POST as marketplaceSelectQuote } from '@/app/api/mobile/v2/jobs/[id]/select-quote/route'
import { cloneRequestWithMarketplaceBearer } from '@/lib/auth/web-marketplace'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request, { includeBody: true })
  if (!authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  return marketplaceSelectQuote(authenticated, context)
}
