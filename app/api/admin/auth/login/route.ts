import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { createStaffSession } from '@/lib/auth/staff-sessions'
import { createAuditLog, getIp } from '@/lib/auth/authorization/admin-rbac'
import { verifyPasswordWithMigration } from '@/lib/security/password'
import type { AdminRole } from '@/lib/admin-types'

function getTempTokenSecret(): string {
  if (!process.env.STAFF_JWT_SECRET) {
    throw new Error('[SECURITY] STAFF_JWT_SECRET env var is required')
  }
  return process.env.STAFF_JWT_SECRET
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
    logger.error('Failed to record admin login attempt', { err: e, route: '/api/admin/auth/login', method: 'POST' })
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

    if (
      adminUser.role === 'SUPER_ADMIN' &&
      (!adminUser.totpEnabled || !adminUser.totpSecret)
    ) {
      // Password is verified. A super-admin that has never enrolled cannot be
      // given a CRM session (the CRM guard requires totpEnabled), so issue a
      // short-lived enrollment-only token instead of dead-ending the owner.
      // This never becomes an AdminSession, access token or refresh token.
      const { issueStaffMfaEnrollmentToken } = await import('@/lib/auth/staff-mfa-enrollment')
      const enrollmentToken = issueStaffMfaEnrollmentToken({
        adminUserId: adminUser.id,
        email: adminUser.email,
      })

      await recordLoginAttempt({
        adminUserId: adminUser.id,
        email,
        ipAddress: ip,
        userAgent,
        success: true,
        failureReason: 'MFA_ENROLLMENT_REQUIRED',
      })

      return NextResponse.json(
        {
          requiresMfaEnrollment: true,
          enrollmentToken,
          email: adminUser.email,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
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
        {
          sub: adminUser.id,
          purpose: '2fa_verify',
          type: 'staff_mfa',
          email: adminUser.email,
        },
        getTempTokenSecret(),
        {
          expiresIn: '5m',
          audience: 'maintainex-staff-mfa',
          issuer: 'maintainex',
        }
      )
      await recordLoginAttempt({ adminUserId: adminUser.id, email, ipAddress: ip, userAgent, success: true, failureReason: '2FA_REQUIRED' })
      return NextResponse.json({ requires2fa: true, tempToken })
    }

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

    await recordLoginAttempt({ adminUserId: adminUser.id, email, ipAddress: ip, userAgent, success: true })

    // Admin device/session context is intentionally recorded through
    // AdminSession + AdminLoginAttempt + SecurityAudit. Do not write the
    // AdminUser ID into UserDevice: UserDevice belongs to the marketplace
    // User model and its foreign key must never be used for staff identities.

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
    logger.error('Admin login failed unexpectedly', { err: error, route: '/api/admin/auth/login', method: 'POST' })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
