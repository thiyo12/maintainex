import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRefreshToken } from '@/lib/auth/authentication/admin-jwt'

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

  // Compatibility cleanup for the historical refresh-only path.
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
      const payload = verifyRefreshToken(refreshToken)
      if (payload) {
        await prisma.adminSession.updateMany({
          where: {
            id: payload.jti,
            adminUserId: payload.sub,
            isRevoked: false,
          },
          data: { isRevoked: true, revokedAt: new Date() },
        })
      }
    }
  } catch (error) {
    revokeFailed = true
    console.error('Logout session revocation error:', error)
  }

  const response = NextResponse.json({
    success: true,
    ...(revokeFailed ? { sessionRevocationPending: true } : {}),
  })
  clearAdminCookies(response)
  return response
}
