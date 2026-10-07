import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { checkRateLimit, ipKey } from '@/lib/rate-limit/middleware'
import { isSyntheticCertAccount } from '@/lib/test-cert'
import { sendOtpEmail } from '@/lib/email'
export async function POST(request: NextRequest) {
  try {
    const ipLimit = await checkRateLimit(request, {
      policyName: 'PASSWORD_RESET',
      keyPrefix: 'password_reset',
      identifier: ipKey(request),
    })
    if (!ipLimit.allowed) return ipLimit.response!

    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: true, message: 'If an account exists with that email, a reset code has been sent.' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    if (!user) {
      return NextResponse.json({ success: true, message: 'If an account exists with that email, a reset code has been sent.' })
    }

    if (
      !user.isActive ||
      user.isBanned ||
      (user.isSuspended && (!user.suspendedUntil || user.suspendedUntil > new Date()))
    ) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a reset code has been sent.',
      })
    }

    const code = isSyntheticCertAccount(user)
      ? '000000'
      : randomInt(0, 1000000).toString().padStart(6, '0')
    const codeHash = await bcrypt.hash(code, 10)

    await prisma.oTP.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', isUsed: false },
      data: { isUsed: true },
    })

    const otpRecord = await prisma.oTP.create({
      data: {
        userId: user.id,
        codeHash,
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    if (!isSyntheticCertAccount(user)) {
      try {
        await sendOtpEmail(user.email, code)
      } catch (error) {
        logger.error('Password reset OTP delivery failed', { err: error })
        await prisma.oTP.updateMany({
          where: { id: otpRecord.id, isUsed: false },
          data: { isUsed: true },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a reset code has been sent.',
    })
  } catch (error) {
    logger.error('Mobile forgot-password request failed unexpectedly', { err: error })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
