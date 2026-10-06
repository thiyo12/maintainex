import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { parseStaffRefreshToken } from '@/lib/auth/staff-rotation'
import { revokeStaffSession } from '@/lib/auth/staff-sessions'

function clearAdminCookies(response: NextResponse) {
  response.cookies.set('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin/auth',
    maxAge: 0,
  })

  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin/auth/refresh',
    maxAge: 0,
  })
}

export async function POST(request: NextRequest) {
  let revokeFailed = false

  try {
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (refreshToken) {
      const parsed = parseStaffRefreshToken(refreshToken)
      if (parsed) {
        await revokeStaffSession(parsed.sessionId)
      }
    }
  } catch (error) {
    revokeFailed = true
    logger.error('Admin logout session revocation failed', { err: error, route: '/api/admin/auth/logout', method: 'POST' })
  }

  const response = NextResponse.json({
    success: true,
    ...(revokeFailed ? { sessionRevocationPending: true } : {}),
  })
  clearAdminCookies(response)
  return response
}
