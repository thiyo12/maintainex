import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { checkRateLimit, ipKey } from '@/lib/rate-limit/middleware'

// TESTING ONLY — replace with real OTP provider before production launch
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

    // 000000 allowed only when ALLOW_TEST_OTP is explicitly enabled
    const code = process.env.ALLOW_TEST_OTP === 'true'
      ? '000000'
      : randomInt(0, 1000000).toString().padStart(6, '0')
    const codeHash = await bcrypt.hash(code, 10)

    await prisma.oTP.create({
      data: {
        userId: user.id,
        codeHash,
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a reset code has been sent.',
    })
  } catch (error) {
    console.error('Mobile forgot password error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
