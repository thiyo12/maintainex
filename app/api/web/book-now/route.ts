import { NextRequest, NextResponse } from 'next/server'
import { POST as bookNow } from '@/app/api/mobile/v2/book-now/route'
import { cloneRequestWithMarketplaceBearer } from '@/lib/auth/web-marketplace'

export async function POST(request: NextRequest) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request, { includeBody: true })
  if (!authenticated) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  return bookNow(authenticated)
}
