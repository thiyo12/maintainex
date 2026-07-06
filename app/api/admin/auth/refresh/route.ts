import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyRefreshToken, signAccessToken, signRefreshToken, generateRefreshTokenValue, hashRefreshToken } from '@/lib/admin-jwt'
import { getIp } from '@/lib/admin-rbac'
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
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired or revoked' }, { status: 401 })
    }

    const adminUser = await prisma.adminUser.findUnique({ where: { id: payload.sub } })
    if (!adminUser || !adminUser.isActive || adminUser.deletedAt) {
      return NextResponse.json({ error: 'Account not active' }, { status: 401 })
    }

    const refreshTokenValue = generateRefreshTokenValue()
    const refreshTokenHash = hashRefreshToken(refreshTokenValue)
    const accessToken = signAccessToken({
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role as AdminRole,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      assignedCountries: parseCountries(adminUser.assignedCountries),
    })

    await prisma.adminSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const newRefreshToken = signRefreshToken(adminUser.id, session.id)

    const response = NextResponse.json({ accessToken })

    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/admin/auth',
      maxAge: 7 * 24 * 60 * 60,
    })

    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/admin/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    })

    return response
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
