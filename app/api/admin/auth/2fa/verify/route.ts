import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { verifyTotp } from '@/lib/admin-2fa'
import { createStaffSession } from '@/lib/auth/staff-sessions'
import { getIp } from '@/lib/auth/authorization/admin-rbac'
import type { AdminRole } from '@/lib/admin-types'

function getTempTokenSecret(): string {
  if (!process.env.STAFF_JWT_SECRET) {
    throw new Error('[SECURITY] STAFF_JWT_SECRET env var is required')
  }
  return process.env.STAFF_JWT_SECRET
}

function parseCountries(val: string): string[] {
  if (!val) return []
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return val.split(',').map(c => c.trim()).filter(Boolean) }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tempToken, totpCode } = body

    if (!tempToken || !totpCode) {
      return NextResponse.json({ error: 'tempToken and totpCode required' }, { status: 400 })
    }

    let tempPayload: { sub: string; purpose: string; email: string }
    try {
      tempPayload = jwt.verify(tempToken, getTempTokenSecret(), {
        audience: 'maintainex-staff-mfa',
        issuer: 'maintainex',
      }) as any
    } catch {
      return NextResponse.json({ error: 'Invalid or expired temp token' }, { status: 401 })
    }

    if (tempPayload.purpose !== '2fa_verify' || (tempPayload as any).type !== 'staff_mfa') {
      return NextResponse.json({ error: 'Invalid token purpose' }, { status: 401 })
    }

    const adminUser = await prisma.adminUser.findUnique({ where: { id: tempPayload.sub } })
    if (
      !adminUser ||
      !adminUser.isActive ||
      adminUser.deletedAt ||
      (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) ||
      !adminUser.totpSecret
    ) {
      return NextResponse.json({ error: 'Account not active or 2FA not configured' }, { status: 401 })
    }

    if (!(await verifyTotp(totpCode, adminUser.totpSecret))) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 })
    }

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { totpEnabled: true, totpVerifiedAt: new Date() },
    })

    const ip = getIp(request)
    const userAgent = request.headers.get('user-agent')
    const staffSession = await createStaffSession({
      adminUserId: adminUser.id,
      ipAddress: ip,
      userAgent: userAgent || undefined,
    })
    const accessToken = staffSession.accessToken
    const refreshToken = staffSession.refreshTokenRaw

    const response = NextResponse.json({
      accessToken,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        assignedCountries: parseCountries(adminUser.assignedCountries),
      },
    })

    response.cookies.set('admin_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 60,
    })

    response.cookies.set('refresh_token', refreshToken, {
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
    console.error('2FA verify error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
