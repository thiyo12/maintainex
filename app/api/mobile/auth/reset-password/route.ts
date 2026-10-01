import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revokeAllUserSessions } from '@/lib/auth/sessions'
import { checkPasswordStrength, hashPassword } from '@/lib/security/password'
import { isTestOtpAllowed } from '@/lib/test-cert'

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Email, code, and new password are required' }, { status: 400 })
    }

    if (typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }
    const strength = checkPasswordStrength(newPassword)
    if (!strength.valid) {
      return NextResponse.json(
        { error: 'Password does not meet security requirements', details: strength.errors },
        { status: 400 }
      )
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const user = normalizedEmail
      ? await prisma.user.findUnique({ where: { email: normalizedEmail } })
      : null
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, the password reset request was processed.'
      }, { status: 200 })
    }

    if (!user.isActive || user.isBanned || (user.isSuspended && (!user.suspendedUntil || user.suspendedUntil > new Date()))) {
      return NextResponse.json({ error: 'Account is not eligible for password reset' }, { status: 403 })
    }

    if (!isTestOtpAllowed(user, code)) {
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

      const consumed = await prisma.oTP.updateMany({
        where: { id: otpRecord.id, isUsed: false },
        data: { isUsed: true },
      })
      if (consumed.count !== 1) {
        return NextResponse.json({ error: 'This reset code was already used.' }, { status: 409 })
      }
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
        const consumed = await prisma.oTP.updateMany({
          where: { id: otpRecord.id, isUsed: false },
          data: { isUsed: true },
        })
        if (consumed.count !== 1) {
          return NextResponse.json({ error: 'This reset code was already used.' }, { status: 409 })
        }
      }
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.oTP.updateMany({
        where: {
          userId: user.id,
          purpose: 'PASSWORD_RESET',
          isUsed: false,
        },
        data: { isUsed: true },
      }),
    ])

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
