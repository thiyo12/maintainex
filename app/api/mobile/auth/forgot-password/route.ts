import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPasswordResetToken } from '@/lib/security/tokens'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (user) {
      const token = await createPasswordResetToken(user.id)
      console.log('Mobile password reset token:', token)
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    })
  } catch (error) {
    console.error('Mobile forgot password error:', error)
    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    })
  }
}
