import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { signAccessToken, signRefreshToken, generateRefreshTokenValue, hashRefreshToken } from '@/lib/auth/authentication/admin-jwt'
import { createAuditLog, getIp } from '@/lib/auth/authorization/admin-rbac'
import { verifyPasswordWithMigration } from '@/lib/security/password'
import type { AdminRole } from '@/lib/admin-types'

function getTempTokenSecret(): string {
  if (!process.env.JWT_SECRET) throw new Error('[SECURITY] JWT_SECRET env var is required')
  return process.env.JWT_SECRET
}
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

    const passwordCheck = await verifyPasswordWithMigration(password, adminUser.passwordHash)
    if (!passwordCheck.valid) {
      const newAttempts = (adminUser.failedLoginAttempts || 0) + 1
      const updateData: Record<string, unknown> = { failedLoginAttempts: newAttempts }
      if (newAttempts >= MAX_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      }
      await prisma.adminUser.update({ where: { id: adminUser.id }, data: updateData as any })
      await recordLoginAttempt({ adminUserId: adminUser.id, email, ipAddress: ip, userAgent, success: false, failureReason: 'INVALID_PASSWORD' })

      try {
        await prisma.rateLimitLog.create({
          data: {
            identifier: ip,
            type: 'login-failed',
            endpoint: '/api/admin/auth/login',
            method: 'POST',
            requestCount: 1,
            windowStart: new Date(),
            windowEnd: new Date(Date.now() + 60 * 60 * 1000),
            limited: false,
          }
        })
      } catch {}

      try {
        const { assessLoginRisk } = await import('@/lib/security/risk-score')
        const risk = await assessLoginRisk(null, email, ip, userAgent || 'unknown')

        if (risk.level === 'HIGH' || risk.level === 'CRITICAL') {
          await prisma.securityAudit.create({
            data: {
              action: 'LOGIN_FAILED_HIGH_RISK',
              category: 'AUTH',
              entityType: 'AdminUser',
              entityId: email,
              riskLevel: risk.level,
              ipAddress: ip,
              userAgent: userAgent || 'unknown',
              details: JSON.stringify({ reasons: risk.reasons, score: risk.score })
            }
          })

          if (risk.level === 'CRITICAL') {
            const { blockIP } = await import('@/lib/security/rate-limiter')
            await blockIP(ip, `Auto-blocked: CRITICAL risk score ${risk.score}`, 60)
          }
        }
      } catch (e) {}

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip },
    })

    if (passwordCheck.needsMigration) {
      try {
        const { hashPassword } = await import('@/lib/security/password')
        const newHash = await hashPassword(password)
        await prisma.adminUser.update({ where: { id: adminUser.id }, data: { passwordHash: newHash } })
      } catch {}
    }

    if (adminUser.totpEnabled && adminUser.totpSecret) {
      const tempToken = jwt.sign(
        { sub: adminUser.id, purpose: '2fa_verify', email: adminUser.email },
        getTempTokenSecret(),
        { expiresIn: '5m' }
      )
      await recordLoginAttempt({ adminUserId: adminUser.id, email, ipAddress: ip, userAgent, success: true, failureReason: '2FA_REQUIRED' })
      return NextResponse.json({ requires2fa: true, tempToken })
    }

    const refreshTokenValue = generateRefreshTokenValue()
    const refreshTokenHash = hashRefreshToken(refreshTokenValue)

    const session = await prisma.adminSession.create({
      data: {
        adminUserId: adminUser.id,
        refreshTokenHash,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const accessToken = signAccessToken({
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role as AdminRole,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      assignedCountries: parseCountries(adminUser.assignedCountries),
      sessionId: session.id,
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

    response.cookies.set('admin_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
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

    // Record device
    try {
      const ua = userAgent || 'unknown'
      await prisma.userDevice.upsert({
        where: { userId_deviceId: { userId: adminUser.id, deviceId: ua } },
        update: { pushToken: null },
        create: { userId: adminUser.id, deviceId: ua, platform: 'web' }
      })
    } catch (e) {}

    // Record successful login event
    try {
      await prisma.securityAudit.create({
        data: {
          action: 'LOGIN_SUCCESS',
          category: 'AUTH',
          userId: adminUser.id,
          entityType: 'AdminUser',
          entityId: adminUser.id,
          riskLevel: 'LOW',
          ipAddress: ip,
          userAgent: userAgent || 'unknown'
        }
      })
    } catch (e) {}

    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
