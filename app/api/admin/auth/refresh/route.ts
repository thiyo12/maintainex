import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { rotateStaffRefreshToken } from '@/lib/auth/staff-rotation'
import { getIp } from '@/lib/auth/authorization/admin-rbac'

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
    }

    const rotated = await rotateStaffRefreshToken(refreshToken, {
      ipAddress: getIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })
    if (!rotated) {
      return NextResponse.json(
        { error: 'Session expired, revoked, or refresh token was replayed' },
        { status: 401 }
      )
    }

    const response = NextResponse.json({ accessToken: rotated.accessToken })

    response.cookies.set('admin_token', rotated.accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 60,
    })

    response.cookies.set('refresh_token', rotated.refreshTokenRaw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/admin/auth',
      maxAge: 7 * 24 * 60 * 60,
    })

    response.cookies.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/admin/auth/refresh',
      maxAge: 0,
    })

    return response
  } catch (error) {
    logger.error('Admin token refresh failed unexpectedly', { err: error, route: '/api/admin/auth/refresh', method: 'POST' })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
