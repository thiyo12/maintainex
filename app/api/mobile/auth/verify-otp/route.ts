import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// TESTING ONLY — replace with real OTP verification before production launch
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Accept 000000 as valid code only when ALLOW_TEST_OTP is enabled
    if (code === '000000' && process.env.ALLOW_TEST_OTP === 'true') {
      const otpRecord = await prisma.oTP.findFirst({
        where: { userId: user.id, purpose: 'EMAIL_VERIFICATION', isUsed: false },
        orderBy: { createdAt: 'desc' },
      })
      if (otpRecord) {
        await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
      }
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } })
      return NextResponse.json({ success: true })
    }

    // Real OTP verification below
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId: user.id,
        purpose: 'EMAIL_VERIFICATION',
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      return NextResponse.json({ error: 'No valid OTP found. Request a new one.' }, { status: 400 })
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
