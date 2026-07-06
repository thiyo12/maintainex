import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { signAccessToken, signRefreshToken, generateRefreshTokenValue, hashRefreshToken } from '@/lib/admin-jwt'
import { createAuditLog, getIp } from '@/lib/admin-rbac'
import type { AdminRole } from '@/lib/admin-types'

const TEMP_TOKEN_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production'
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 30

function parseCountries(val: string): string[] {
  if (!val) return []
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return val.split(',').map(c => c.trim()).filter(Boolean) }
}

async function recordLoginAttempt(params: {
  adminUserId?: string
  email: string
  ipAddress: string
  userAgent: string | null
  success: boolean
  failureReason?: string
}) {
  try {
    await prisma.adminLoginAttempt.create({ data: params })
  } catch (e) {
    console.error('Failed to record login attempt:', e)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getIp(request)
    const userAgent = request.headers.get('user-agent')

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const adminUser = await prisma.adminUser.findUnique({ where: { email } })

    if (!adminUser) {
      await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: false, failureReason: 'USER_NOT_FOUND' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!adminUser.isActive || adminUser.deletedAt) {
      await recordLoginAttempt({ adminUserId: adminUser.id, email, ipAddress: ip, userAgent, success: false, failureReason: 'ACCOUNT_DEACTIVATED' })
      return NextResponse.json({ error: 'Account deactivated' }, { status: 401 })
    }

    if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
      const remainingMin = Math.ceil((adminUser.lockedUntil.getTime() - Date.now()) / 60000)
      return NextResponse.json({ error: `Account locked. Try again in ${remainingMin} minutes.` }, { status: 423 })
    }

    const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash)
    if (!isValidPassword) {
      const newAttempts = (adminUser.failedLoginAttempts || 0) + 1
      const updateData: Record<string, unknown> = { failedLoginAttempts: newAttempts }
      if (newAttempts >= MAX_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      }
      await prisma.adminUser.update({ where: { id: adminUser.id }, data: updateData as any })
      await recordLoginAttempt({ adminUserId: adminUser.id, email, ipAddress: ip, userAgent, success: false, failureReason: 'INVALID_PASSWORD' })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip },
    })

    if (adminUser.totpEnabled && adminUser.totpSecret) {
      const tempToken = jwt.sign(
        { sub: adminUser.id, purpose: '2fa_verify', email: adminUser.email },
        TEMP_TOKEN_SECRET,
        { expiresIn: '5m' }
      )
      await recordLoginAttempt({ adminUserId: adminUser.id, email, ipAddress: ip, userAgent, success: true, failureReason: '2FA_REQUIRED' })
      return NextResponse.json({ requires2fa: true, tempToken })
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

    const session = await prisma.adminSession.create({
      data: {
        adminUserId: adminUser.id,
        refreshTokenHash,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const refreshToken = signRefreshToken(adminUser.id, session.id)

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

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/admin/auth',
      maxAge: 7 * 24 * 60 * 60,
    })

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/admin/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    })

    await recordLoginAttempt({ adminUserId: adminUser.id, email, ipAddress: ip, userAgent, success: true })

    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
