import { NextRequest, NextResponse } from 'next/server'
import { GET as marketplaceJobGet, PATCH as marketplaceJobPatch } from '@/app/api/mobile/v2/jobs/[id]/route'
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
  return marketplaceJobGet(authenticated, context)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request, { includeBody: true })
  if (!authenticated) return unauthorized()
  return marketplaceJobPatch(authenticated, context)
}
