import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createToken } from '@/lib/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const { email, phone, code, purpose } = await request.json()

    if (!code) {
      return NextResponse.json({ error: 'Code required' }, { status: 400 })
    }

    let user = null
    if (email) {
      user = await prisma.user.findUnique({ where: { email } })
    } else if (phone) {
      const digits = phone.replace(/\D/g, '').slice(-9)
      user = await prisma.user.findFirst({ where: { phone: { endsWith: digits } } })
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const otpPurpose = purpose || 'EMAIL_VERIFICATION'

    if (code === '000000' && process.env.ALLOW_TEST_OTP === 'true') {
      const otpRecord = await prisma.oTP.findFirst({
        where: { userId: user.id, purpose: otpPurpose, isUsed: false },
        orderBy: { createdAt: 'desc' },
      })
      if (otpRecord) {
        await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
      }
      if (otpPurpose === 'PHONE_VERIFICATION') {
        await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } })
        const token = createToken({ id: user.id, email: user.email, role: user.role })
        if (!token) return NextResponse.json({ error: 'Server error' }, { status: 500 })
        return NextResponse.json({
          token,
          user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, isActive: user.isActive, createdAt: user.createdAt.toISOString() },
        })
      }
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } })
      return NextResponse.json({ success: true })
    }

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId: user.id,
        purpose: otpPurpose,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      return NextResponse.json({ error: 'No valid OTP found. Request a new one.' }, { status: 400 })
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

    if (otpPurpose === 'PHONE_VERIFICATION') {
      await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      })
      const token = createToken({ id: user.id, email: user.email, role: user.role })
      if (!token) return NextResponse.json({ error: 'Server error' }, { status: 500 })
      return NextResponse.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, isActive: user.isActive, createdAt: user.createdAt.toISOString() },
      })
    }

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
