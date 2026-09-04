import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { createToken } from '@/lib/mobile-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendOtpEmail } from '@/lib/email'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function findUserByIdentifier(identifier: string) {
  if (EMAIL_REGEX.test(identifier)) {
    return prisma.user.findUnique({ where: { email: identifier } })
  }
  const digits = identifier.replace(/\D/g, '')
  if (!digits) return null
  const candidates = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { phone: true },
  })
  const match = candidates.find((c) => c.phone && c.phone.replace(/\D/g, '') === digits)
  if (!match) return null
  return prisma.user.findFirst({ where: { phone: match.phone } })
}

function accountBlocked(user: any): NextResponse | null {
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
  return null
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const body = await request.json()
    const emailId = typeof body.email === 'string' ? body.email.trim() : ''
    const phoneId = typeof body.phone === 'string' ? body.phone.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''

    const identifier = emailId || phoneId
    if (!identifier) {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 })
    }

    const user = await findUserByIdentifier(identifier)
    if (!user) {
      return NextResponse.json({ error: 'No account found with this email or phone number.' }, { status: 404 })
    }

    const blocked = accountBlocked(user)
    if (blocked) return blocked

    if (!code) {
      const { allowed } = checkRateLimit(ip, 5)
      if (!allowed) {
        return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
      }

      const otp = process.env.ALLOW_TEST_OTP === 'true'
        ? '000000'
        : randomInt(0, 1000000).toString().padStart(6, '0')
      const codeHash = await bcrypt.hash(otp, 10)

      await prisma.oTP.create({
        data: {
          userId: user.id,
          codeHash,
          purpose: 'LOGIN',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      })

      if (user.email) {
        await sendOtpEmail(user.email, otp)
      }

      return NextResponse.json({ success: true })
    }

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId: user.id,
        purpose: 'LOGIN',
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      return NextResponse.json({ error: 'No valid code found. Request a new one.' }, { status: 400 })
    }

    if (code === '000000' && process.env.ALLOW_TEST_OTP === 'true') {
      await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
    } else {
      const isValid = await bcrypt.compare(code, otpRecord.codeHash)
      if (!isValid) {
        await prisma.oTP.update({
          where: { id: otpRecord.id },
          data: { attempts: { increment: 1 } },
        })
        return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
      }
      await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
    }

    const token = createToken({ id: user.id, email: user.email, role: user.role })
    if (!token) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, isActive: user.isActive, createdAt: user.createdAt.toISOString() },
    })
  } catch (error) {
    console.error('OTP login error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}