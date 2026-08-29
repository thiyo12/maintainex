import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { checkRateLimit } from '@/lib/rate-limit'
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const { allowed } = checkRateLimit(ip, 3)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // 000000 allowed only when ALLOW_TEST_OTP is explicitly enabled
    const code = process.env.ALLOW_TEST_OTP === 'true'
      ? '000000'
      : randomInt(0, 1000000).toString().padStart(6, '0')
    const codeHash = await bcrypt.hash(code, 10)

    await prisma.oTP.create({
      data: {
        userId: user.id,
        codeHash,
        purpose: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
