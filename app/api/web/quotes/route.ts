import { NextRequest, NextResponse } from 'next/server'
import { GET as marketplaceQuotesGet, POST as marketplaceQuotesPost } from '@/app/api/mobile/v2/quotes/route'
import { cloneRequestWithMarketplaceBearer } from '@/lib/auth/web-marketplace'

function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function GET(request: NextRequest) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request)
  if (!authenticated) return unauthorized()
  return marketplaceQuotesGet(authenticated)
}

export async function POST(request: NextRequest) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request, { includeBody: true })
  if (!authenticated) return unauthorized()
  return marketplaceQuotesPost(authenticated)
}
