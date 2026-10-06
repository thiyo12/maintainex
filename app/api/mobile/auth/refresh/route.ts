import { NextRequest, NextResponse } from 'next/server'
import { rotateMarketplaceRefreshToken } from '@/lib/auth/rotation'
import { AuthError } from '@/lib/auth/errors'
import { checkRateLimit, ipKey } from '@/lib/shared/rate-limit/middleware'
import { getTrustedClientIp } from '@/lib/security/client-ip'

const MAX_REFRESH_BODY_BYTES = 2048

export async function POST(request: NextRequest) {
  try {
    const limit = await checkRateLimit(request, {
      policyName: 'AUTH',
      keyPrefix: 'marketplace_refresh',
      identifier: ipKey(request),
    })
    if (!limit.allowed) return limit.response!

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_REFRESH_BODY_BYTES) {
      return NextResponse.json({ error: 'Request payload too large' }, { status: 413 })
    }

    const rawBody = await request.text()
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REFRESH_BODY_BYTES) {
      return NextResponse.json({ error: 'Request payload too large' }, { status: 413 })
    }

    let body: Record<string, unknown>
    try {
      const parsed = JSON.parse(rawBody)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
      }
      body = parsed as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : ''

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 })
    }

    const ip = getTrustedClientIp(request.headers)
    const userAgent = request.headers.get('user-agent') || undefined

    const result = await rotateMarketplaceRefreshToken(refreshToken, {
      ipAddress: ip === 'unknown' ? undefined : ip,
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
