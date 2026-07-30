import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPasswordResetToken } from '@/lib/security/tokens'
import { checkPasswordStrength, hashPassword } from '@/lib/security/password'

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json()

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
    }

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

    await prisma.user.update({
      where: { id: result.userId },
      data: { passwordHash },
    })

    try {
      await prisma.adminSession.deleteMany({ where: { adminUserId: result.userId } })
    } catch {}

    try {
      await prisma.securityAudit.create({
        data: {
          action: 'PASSWORD_RESET_COMPLETED',
          category: 'AUTH',
          userId: result.userId,
          entityType: 'User',
          entityId: result.userId,
          riskLevel: 'LOW',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        }
      })
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully.',
    })
  } catch (error) {
    console.error('Mobile reset password error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
