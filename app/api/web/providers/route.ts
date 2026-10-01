import { NextRequest, NextResponse } from 'next/server'
import { GET as findTaskers } from '@/app/api/mobile/find-tasker/route'
import { cloneRequestWithMarketplaceBearer } from '@/lib/auth/web-marketplace'

export async function GET(request: NextRequest) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request)
  if (!authenticated) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  return findTaskers(authenticated)
}
