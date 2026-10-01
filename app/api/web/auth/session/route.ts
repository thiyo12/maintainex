import { NextRequest, NextResponse } from 'next/server'
import { GET as marketplaceMe } from '@/app/api/mobile/auth/me/route'
import { cloneRequestWithMarketplaceBearer } from '@/lib/auth/web-marketplace'

export async function GET(request: NextRequest) {
  const authenticated = await cloneRequestWithMarketplaceBearer(request)
  if (!authenticated) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const upstream = await marketplaceMe(authenticated)
  const payload = await upstream.json().catch(() => ({}))

  if (!upstream.ok) {
    return NextResponse.json(
      { authenticated: false, error: payload?.error || 'Unauthorized' },
      { status: upstream.status, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  return NextResponse.json(
    { authenticated: true, ...payload },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
