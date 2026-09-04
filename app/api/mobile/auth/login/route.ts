import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPasswordWithMigration } from '@/lib/security/password'
import { createToken } from '@/lib/mobile-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const { allowed, resetAt } = checkRateLimit(ip)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.', resetAt: new Date(resetAt).toISOString() }, { status: 429 })
    }

    const { email, password } = await request.json()
    const identifier = typeof email === 'string' ? email.trim() : ''
    if (!identifier || !password) {
      return NextResponse.json({ error: 'Email/phone and password required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let user: Awaited<ReturnType<typeof prisma.user.findFirst>> = null
    if (emailRegex.test(identifier)) {
      user = await prisma.user.findUnique({ where: { email: identifier } })
    } else {
      const digits = identifier.replace(/\D/g, '')
      const candidates = await prisma.user.findMany({
        where: { phone: { not: null } },
        select: { phone: true },
      })
      const match = candidates.find((c) => c.phone && c.phone.replace(/\D/g, '') === digits)
      user = match ? await prisma.user.findFirst({ where: { phone: match.phone } }) : null
    }
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 401 })
    }

    if (user.isSuspended) {
      if (!user.suspendedUntil || new Date(user.suspendedUntil) > new Date()) {
        return NextResponse.json({
          error: 'Account suspended',
          code: 'SUSPENDED',
          reason: user.suspensionReason || 'Your account has been suspended. Please contact support.',
          suspendedUntil: user.suspendedUntil?.toISOString() || null,
        }, { status: 403 })
      }
    }

    if (user.isBanned) {
      return NextResponse.json({
        error: 'Account banned',
        code: 'BANNED',
        reason: user.banReason || 'Your account has been permanently banned.',
      }, { status: 403 })
    }

    const failIp = request.headers.get('x-forwarded-for')?.split(',')[0] || ip

    const failedRecord = await prisma.failedLogin.findUnique({
      where: { email_ipAddress: { email: identifier, ipAddress: failIp } }
    })
    if (failedRecord && failedRecord.blocked && failedRecord.blockUntil && failedRecord.blockUntil > new Date()) {
      const remainingMin = Math.ceil((failedRecord.blockUntil.getTime() - Date.now()) / 60000)
      return NextResponse.json({ error: `Account temporarily locked. Try again in ${remainingMin} minutes.` }, { status: 423 })
    }

    const totalFailuresForEmail = await prisma.failedLogin.aggregate({
      where: { email: identifier, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      _sum: { attemptCount: true },
    })
    const totalAttempts = totalFailuresForEmail._sum.attemptCount || 0
    if (totalAttempts >= 15) {
      return NextResponse.json({ error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' }, { status: 423 })
    }

    const passwordCheck = await verifyPasswordWithMigration(password, user.passwordHash)
    if (!passwordCheck.valid) {
      try {
        await prisma.failedLogin.upsert({
          where: { email_ipAddress: { email: identifier, ipAddress: failIp } },
          update: {
            attemptCount: { increment: 1 },
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
          create: {
            email: identifier,
            ipAddress: failIp,
            userAgent: request.headers.get('user-agent') || 'unknown',
            attemptCount: 1,
            blocked: false,
          }
        })

        const updatedRecord = await prisma.failedLogin.findUnique({
          where: { email_ipAddress: { email: identifier, ipAddress: failIp } }
        })
        if (updatedRecord && updatedRecord.attemptCount >= 5) {
          await prisma.failedLogin.update({
            where: { email_ipAddress: { email: identifier, ipAddress: failIp } },
            data: { blocked: true, blockUntil: new Date(Date.now() + 15 * 60 * 1000) }
          })
        }

        const newTotal = await prisma.failedLogin.aggregate({
          where: { email: identifier, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
          _sum: { attemptCount: true },
        })
        if ((newTotal._sum.attemptCount || 0) >= 10) {
          await prisma.failedLogin.updateMany({
            where: { email: identifier },
            data: { blocked: true, blockUntil: new Date(Date.now() + 15 * 60 * 1000) }
          })
        }

        try {
          await prisma.rateLimitLog.create({
            data: {
              identifier: failIp,
              type: 'login-failed',
              endpoint: '/api/mobile/auth/login',
              method: 'POST',
              requestCount: 1,
              windowStart: new Date(),
              windowEnd: new Date(Date.now() + 60 * 60 * 1000),
              limited: false,
            }
          })
        } catch {}

        const diffEmailCount = await prisma.failedLogin.groupBy({
          by: ['email'],
          where: {
            ipAddress: failIp,
            createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
          },
        })
        if (diffEmailCount.length >= 5) {
          try {
            const { blockIP } = await import('@/lib/security/rate-limiter')
            await blockIP(failIp, 'CREDENTIAL_STUFFING: 5+ different emails tested from same IP in 15 minutes', 60)
            const { recordSecurityEvent } = await import('@/lib/security/risk-score')
            await recordSecurityEvent('CREDENTIAL_STUFFING', 'SECURITY', null, 'IP', failIp, 'CRITICAL', {
              emailCount: diffEmailCount.length,
              emails: diffEmailCount.map((e) => e.email),
            })
          } catch {}
        }

        const { assessLoginRisk } = await import('@/lib/security/risk-score')
        const risk = await assessLoginRisk(null, identifier, failIp, request.headers.get('user-agent') || 'unknown')
        if (risk.level === 'CRITICAL') {
          const { blockIP } = await import('@/lib/security/rate-limiter')
          await blockIP(failIp, 'CRITICAL risk - mobile login brute force', 60)
        }
      } catch (e) {}

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    try {
      await prisma.failedLogin.deleteMany({ where: { email: identifier } })
    } catch {}

    if (passwordCheck.needsMigration) {
      try {
        const { hashPassword } = await import('@/lib/security/password')
        const newHash = await hashPassword(password)
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })
      } catch {}
    }

    try {
      await prisma.rateLimitLog.create({
        data: {
          identifier: failIp,
          type: 'login-success',
          endpoint: '/api/mobile/auth/login',
          method: 'POST',
          requestCount: 1,
          windowStart: new Date(),
          windowEnd: new Date(Date.now() + 60 * 60 * 1000),
          limited: false,
        }
      })
    } catch {}

    try {
      const devIp = request.headers.get('x-forwarded-for')?.split(',')[0] || ip
      const userAgent = request.headers.get('user-agent') || 'unknown'
      await prisma.userDevice.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId: userAgent } },
        update: { pushToken: null },
        create: { userId: user.id, deviceId: userAgent, platform: 'web' }
      })
    } catch (e) {}

    const token = createToken({ id: user.id, email: user.email, role: user.role })
    if (!token) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, isActive: user.isActive, createdAt: user.createdAt.toISOString() },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
