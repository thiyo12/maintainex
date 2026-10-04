import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRefreshToken, signAccessToken, signRefreshToken, hashRefreshToken, matchesRefreshTokenHash } from '@/lib/auth/authentication/admin-jwt'
import { getIp } from '@/lib/auth/authorization/admin-rbac'
import type { AdminRole } from '@/lib/admin-types'

function parseCountries(val: string): string[] {
  if (!val) return []
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return val.split(',').map(c => c.trim()).filter(Boolean) }
}

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value
    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
    }

    const payload = verifyRefreshToken(refreshToken)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
    }

    const session = await prisma.adminSession.findUnique({ where: { id: payload.jti } })
    if (
      !session ||
      session.adminUserId !== payload.sub ||
      session.isRevoked ||
      session.expiresAt < new Date() ||
      !matchesRefreshTokenHash(refreshToken, session.refreshTokenHash)
    ) {
      return NextResponse.json({ error: 'Session expired, revoked, or refresh token was rotated' }, { status: 401 })
    }

    const adminUser = await prisma.adminUser.findUnique({ where: { id: payload.sub } })
    if (
      !adminUser ||
      !adminUser.isActive ||
      adminUser.deletedAt ||
      (adminUser.lockedUntil && adminUser.lockedUntil > new Date())
    ) {
      return NextResponse.json({ error: 'Account not active' }, { status: 401 })
    }

    if (
      adminUser.role === 'SUPER_ADMIN' &&
      (!adminUser.totpEnabled || !adminUser.totpSecret)
    ) {
      await prisma.adminSession.updateMany({
        where: { id: session.id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      })
      return NextResponse.json(
        {
          error: 'Super-admin MFA enrollment is required.',
          code: 'MFA_ENROLLMENT_REQUIRED',
        },
        { status: 401 }
      )
    }

    const newRefreshToken = signRefreshToken(adminUser.id, session.id)
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken)

    const rotated = await prisma.adminSession.updateMany({
      where: {
        id: session.id,
        adminUserId: adminUser.id,
        isRevoked: false,
        refreshTokenHash: session.refreshTokenHash,
      },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    if (rotated.count !== 1) {
      return NextResponse.json({ error: 'Refresh token was already rotated' }, { status: 401 })
    }

    const accessToken = signAccessToken({
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role as AdminRole,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      assignedCountries: parseCountries(adminUser.assignedCountries),
      sessionId: session.id,
    })

    const response = NextResponse.json({ accessToken })

    response.cookies.set('admin_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    })

    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/admin/auth',
      maxAge: 7 * 24 * 60 * 60,
    })

    // Remove the historical narrower cookie to avoid duplicate same-name
    // refresh cookies being sent to the refresh endpoint.
    response.cookies.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/admin/auth/refresh',
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
