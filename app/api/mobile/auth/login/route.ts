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
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Account deactivated' }, { status: 401 })
    }

    const failIp = request.headers.get('x-forwarded-for')?.split(',')[0] || ip

    const failedRecord = await prisma.failedLogin.findUnique({
      where: { email_ipAddress: { email, ipAddress: failIp } }
    })
    if (failedRecord && failedRecord.blocked && failedRecord.blockUntil && failedRecord.blockUntil > new Date()) {
      const remainingMin = Math.ceil((failedRecord.blockUntil.getTime() - Date.now()) / 60000)
      return NextResponse.json({ error: `Account temporarily locked. Try again in ${remainingMin} minutes.` }, { status: 423 })
    }

    const passwordCheck = await verifyPasswordWithMigration(password, user.passwordHash)
    if (!passwordCheck.valid) {
      try {
        await prisma.failedLogin.upsert({
          where: { email_ipAddress: { email, ipAddress: failIp } },
          update: {
            attemptCount: { increment: 1 },
            blocked: { set: true },
            blockUntil: new Date(Date.now() + 15 * 60 * 1000),
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
          create: {
            email,
            ipAddress: failIp,
            userAgent: request.headers.get('user-agent') || 'unknown',
            attemptCount: 1,
            blocked: false,
          }
        })

        const updatedRecord = await prisma.failedLogin.findUnique({
          where: { email_ipAddress: { email, ipAddress: failIp } }
        })
        if (updatedRecord && updatedRecord.attemptCount >= 5) {
          await prisma.failedLogin.update({
            where: { email_ipAddress: { email, ipAddress: failIp } },
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

        const { assessLoginRisk } = await import('@/lib/security/risk-score')
        const risk = await assessLoginRisk(null, email, failIp, request.headers.get('user-agent') || 'unknown')
        if (risk.level === 'CRITICAL') {
          const { blockIP } = await import('@/lib/security/rate-limiter')
          await blockIP(failIp, 'CRITICAL risk - mobile login brute force', 60)
        }
      } catch (e) {}

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    try {
      await prisma.failedLogin.deleteMany({ where: { email } })
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
