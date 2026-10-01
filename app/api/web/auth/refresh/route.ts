import { NextRequest, NextResponse } from 'next/server'
import { rotateMarketplaceRefreshToken } from '@/lib/auth/rotation'
import { AuthError } from '@/lib/auth/errors'
import {
  applyMarketplaceWebAuthCookies,
  clearMarketplaceWebAuthCookies,
  getMarketplaceWebRefreshToken,
} from '@/lib/auth/web-marketplace'

export async function POST(request: NextRequest) {
  const refreshToken = getMarketplaceWebRefreshToken(request)
  if (!refreshToken) {
    const response = NextResponse.json({ error: 'Session expired' }, { status: 401 })
    return clearMarketplaceWebAuthCookies(response)
  }

  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined
    const userAgent = request.headers.get('user-agent') || undefined

    const result = await rotateMarketplaceRefreshToken(refreshToken, {
      ipAddress: ip,
      userAgent,
    })

    const response = NextResponse.json(
      { success: true, expiresIn: 900, sessionExpiresAt: result.sessionExpiresAt.toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    )

    return applyMarketplaceWebAuthCookies(response, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessExpiresIn: 900,
      sessionExpiresAt: result.sessionExpiresAt.toISOString(),
    })
  } catch (error) {
    const response = NextResponse.json(
      {
        error: error instanceof AuthError ? error.message : 'Session refresh failed',
        ...(error instanceof AuthError ? { code: error.code } : {}),
      },
      { status: error instanceof AuthError ? error.status : 401 }
    )
    return clearMarketplaceWebAuthCookies(response)
  }
}
