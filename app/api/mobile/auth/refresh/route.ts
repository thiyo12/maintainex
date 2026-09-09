import { NextRequest, NextResponse } from 'next/server'
import { rotateMarketplaceRefreshToken } from '@/lib/auth/rotation'
import { AuthError } from '@/lib/auth/errors'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : ''

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined
    const userAgent = request.headers.get('user-agent') || undefined

    const result = await rotateMarketplaceRefreshToken(refreshToken, {
      ipAddress: ip,
      userAgent,
    })

    return NextResponse.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: 900,
      sessionExpiresAt: result.sessionExpiresAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
