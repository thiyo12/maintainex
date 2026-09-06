import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendOtpEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') ?? ''
    const { allowed } = checkRateLimit(ip, 5)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const { name, phone, email, role } = await request.json()

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone number required' }, { status: 400 })
    }

    if (name.length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
    }

    const digits = phone.replace(/\D/g, '').slice(-9)
    if (digits.length < 7) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const validRoles = ['CUSTOMER', 'TASKER', 'COMPANY']
    const userRole = validRoles.includes(role) ? role : 'CUSTOMER'

    const existingPhone = await prisma.user.findFirst({
      where: { phone: { endsWith: digits } },
    })
    if (existingPhone) {
      return NextResponse.json({ error: 'Phone number already registered' }, { status: 409 })
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
      const existingEmail = await prisma.user.findUnique({ where: { email } })
      if (existingEmail) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
      }
    }

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || `${phone.replace(/\D/g, '')}@maintainex.pending`,
        passwordHash: '',
        phoneVerified: false,
        role: userRole,
      },
    })

    if (userRole === 'TASKER') {
      await prisma.taskerProfile.create({
        data: { userId: user.id },
      })
    }

    const otp = process.env.ALLOW_TEST_OTP === 'true'
      ? '000000'
      : randomInt(0, 1000000).toString().padStart(6, '0')
    const codeHash = await bcrypt.hash(otp, 10)

    await prisma.oTP.create({
      data: {
        userId: user.id,
        codeHash,
        purpose: 'PHONE_VERIFICATION',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        metadata: { ip, userAgent },
      },
    })

    if (email) {
      await sendOtpEmail(email, otp)
    }

    return NextResponse.json({
      requiresVerification: true,
      userId: user.id,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
