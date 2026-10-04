import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPasswordResetToken } from '@/lib/security/tokens'
import { checkRateLimit, hashKey, ipKey } from '@/lib/rate-limit/middleware'

export async function POST(request: NextRequest) {
  try {
    const ipLimit = await checkRateLimit(request, {
      policyName: 'PASSWORD_RESET',
      keyPrefix: 'password_reset_ip',
      identifier: ipKey(request),
    })
    if (!ipLimit.allowed) return ipLimit.response!

    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' })
    }

    const normalizedEmail = email.toLowerCase().trim().slice(0, 320)
    const accountLimit = await checkRateLimit(request, {
      policyName: 'PASSWORD_RESET',
      keyPrefix: 'password_reset_account',
      identifier: hashKey(normalizedEmail),
    })
    if (!accountLimit.allowed) return accountLimit.response!

    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (user) {
      const token = await createPasswordResetToken(user.id)
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    })
  }
}
