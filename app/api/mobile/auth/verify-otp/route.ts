import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createMarketplaceAuthSession, buildAuthResponse } from '@/lib/auth/marketplace-session'
import { checkRateLimit, ipKey } from '@/lib/rate-limit/middleware'

function accountBlocked(user: any): NextResponse | null {
  if (!user.isActive) {
    return NextResponse.json({ error: 'Account deactivated' }, { status: 401 })
  }
  if (user.isSuspended && (!user.suspendedUntil || new Date(user.suspendedUntil) > new Date())) {
    return NextResponse.json({
      error: 'Account suspended',
      code: 'SUSPENDED',
      reason: user.suspensionReason || 'Your account has been suspended. Please contact support.',
      suspendedUntil: user.suspendedUntil?.toISOString() || null,
    }, { status: 403 })
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

async function buildPhoneVerificationAuthResponse(request: NextRequest, userId: string) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined
  const userAgent = request.headers.get('user-agent') || undefined
  const authSession = await createMarketplaceAuthSession(userId, { ipAddress: ip, userAgent })
  const response = buildAuthResponse(authSession)
  return NextResponse.json({
    ...response,
    token: response.accessToken,
  })
}

export async function POST(request: NextRequest) {
  try {
    const ipLimit = await checkRateLimit(request, {
      policyName: 'OTP_VERIFY',
      keyPrefix: 'otp_verify',
      identifier: ipKey(request),
    })
    if (!ipLimit.allowed) return ipLimit.response!

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : ''

    if (!code) {
      return NextResponse.json({ error: 'Code required' }, { status: 400 })
    }

    let user = null
    if (email) {
      user = await prisma.user.findUnique({ where: { email } })
    } else if (phone) {
      const digits = phone.replace(/\D/g, '').slice(-9)
      if (!digits) return NextResponse.json({ error: 'Valid email or phone required' }, { status: 400 })
      user = await prisma.user.findFirst({ where: { phone: { endsWith: digits } } })
    } else {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 })
    }

    const blocked = accountBlocked(user)
    if (blocked) return blocked

    const otpPurpose = purpose || 'EMAIL_VERIFICATION'
    if (!['EMAIL_VERIFICATION', 'PHONE_VERIFICATION'].includes(otpPurpose)) {
      return NextResponse.json({ error: 'Unsupported verification purpose' }, { status: 400 })
    }

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId: user.id,
        purpose: otpPurpose,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      return NextResponse.json({ error: 'No valid OTP found. Request a new one.' }, { status: 400 })
    }

    if (otpRecord.attempts >= 5) {
      await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 })
    }

    const testOtpAllowed = code === '000000' && process.env.ALLOW_TEST_OTP === 'true'
    if (!testOtpAllowed) {
      const isValid = await bcrypt.compare(code, otpRecord.codeHash)
      if (!isValid) {
        await prisma.oTP.update({
          where: { id: otpRecord.id },
          data: { attempts: { increment: 1 } },
        })
        return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
      }
    }

    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    })

    if (otpPurpose === 'PHONE_VERIFICATION') {
      await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      })
      return buildPhoneVerificationAuthResponse(request, user.id)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
