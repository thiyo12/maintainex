import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revokeAllUserSessions } from '@/lib/auth/sessions'
import { hashPassword } from '@/lib/security/password'

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Email, code, and new password are required' }, { status: 400 })
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, the password reset request was processed.'
      }, { status: 200 })
    }

    if (!user.isActive || user.isBanned || (user.isSuspended && (!user.suspendedUntil || user.suspendedUntil > new Date()))) {
      return NextResponse.json({ error: 'Account is not eligible for password reset' }, { status: 403 })
    }

    if (code !== '000000' || process.env.ALLOW_TEST_OTP !== 'true') {
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          userId: user.id,
          purpose: 'PASSWORD_RESET',
          isUsed: false,
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!otpRecord) {
        return NextResponse.json({ error: 'No valid reset code found. Request a new one.' }, { status: 400 })
      }

      if (otpRecord.attempts >= 5) {
        await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
        return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 })
      }

      const isValid = await bcrypt.compare(code, otpRecord.codeHash)
      if (!isValid) {
        await prisma.oTP.update({
          where: { id: otpRecord.id },
          data: { attempts: { increment: 1 } },
        })
        return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
      }

      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      })
    } else {
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          userId: user.id,
          purpose: 'PASSWORD_RESET',
          isUsed: false,
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (otpRecord) {
        await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
      }
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    await revokeAllUserSessions(user.id, 'password_reset')

    return NextResponse.json({
      success: true,
      requiresLogin: true,
      message: 'Password reset successful. Please sign in again.',
    })
  } catch (error) {
    console.error('Mobile reset password error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
