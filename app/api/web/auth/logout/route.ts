import { NextRequest, NextResponse } from 'next/server'
import { POST as marketplaceLogout } from '@/app/api/mobile/auth/logout/route'
import {
  clearMarketplaceWebAuthCookies,
  cloneRequestWithMarketplaceBearer,
} from '@/lib/auth/web-marketplace'

export async function POST(request: NextRequest) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request)
  if (authenticated) {
    await marketplaceLogout(
      new NextRequest(authenticated.url, {
        method: 'POST',
        headers: authenticated.headers,
        body: JSON.stringify({ all: false }),
      })
    ).catch(() => undefined)
  }

  return clearMarketplaceWebAuthCookies(
    NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  )
}
