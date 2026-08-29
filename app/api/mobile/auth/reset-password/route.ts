import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createToken } from '@/lib/mobile-auth'
import { hashPassword } from '@/lib/security/password'

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Email, code, and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a reset code will be sent.'
      }, { status: 200 })
    }

    // Accept 000000 as valid code only when ALLOW_TEST_OTP is enabled
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
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    const token = createToken({ id: user.id, email: user.email, role: user.role })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Mobile reset password error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
