import { NextRequest, NextResponse } from 'next/server'
import {
  GET as marketplacePaymentGet,
  POST as marketplacePaymentPost,
} from '@/app/api/mobile/v2/jobs/[id]/payment/route'
import { cloneRequestWithMarketplaceBearer } from '@/lib/auth/web-marketplace'

function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request)
  if (!authenticated) return unauthorized()
  return marketplacePaymentGet(authenticated, context)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request, { includeBody: true })
  if (!authenticated) return unauthorized()
  return marketplacePaymentPost(authenticated, context)
}
