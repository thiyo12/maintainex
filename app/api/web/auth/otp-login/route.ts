import { NextRequest, NextResponse } from 'next/server'
import { POST as marketplaceOtpLogin } from '@/app/api/mobile/auth/otp-login/route'
import {
  applyMarketplaceWebAuthCookies,
  safeMarketplaceAuthPayload,
} from '@/lib/auth/web-marketplace'

export async function POST(request: NextRequest) {
  const upstream = await marketplaceOtpLogin(request)
  const payload = await upstream.json().catch(() => ({}))

  const response = NextResponse.json(
    safeMarketplaceAuthPayload(payload),
    {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store' },
    }
  )

  if (
    upstream.ok &&
    typeof payload?.accessToken === 'string' &&
    typeof payload?.refreshToken === 'string'
  ) {
    applyMarketplaceWebAuthCookies(response, {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      accessExpiresIn: payload.accessExpiresIn,
      sessionExpiresAt: payload.sessionExpiresAt,
    })
  }

  return response
}
