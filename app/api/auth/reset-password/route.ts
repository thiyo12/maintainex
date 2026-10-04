import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPasswordResetToken } from '@/lib/security/tokens'
import { checkPasswordStrength, hashPassword } from '@/lib/security/password'
import { checkRateLimit, hashKey, ipKey } from '@/lib/rate-limit/middleware'

export async function POST(request: NextRequest) {
  try {
    const ipLimit = await checkRateLimit(request, {
      policyName: 'PASSWORD_RESET',
      keyPrefix: 'password_reset_verify_ip',
      identifier: ipKey(request),
    })
    if (!ipLimit.allowed) return ipLimit.response!

    const { token, newPassword } = await request.json()

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
    }
    if (typeof token !== 'string' || token.length > 512 || typeof newPassword !== 'string' || newPassword.length > 256) {
      return NextResponse.json({ error: 'Invalid reset request' }, { status: 400 })
    }

    const tokenLimit = await checkRateLimit(request, {
      policyName: 'PASSWORD_RESET',
      keyPrefix: 'password_reset_token',
      identifier: hashKey(token),
    })
    if (!tokenLimit.allowed) return tokenLimit.response!

    const strength = checkPasswordStrength(newPassword)
    if (!strength.valid) {
      return NextResponse.json({
        error: 'Password is not strong enough',
        feedback: strength.errors,
      }, { status: 400 })
    }

    const result = await verifyPasswordResetToken(token)
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    const passwordHash = await hashPassword(newPassword)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: result.userId },
        data: { passwordHash },
      }),
      prisma.userSession.updateMany({
        where: { userId: result.userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokeReason: 'password_reset',
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully.',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
