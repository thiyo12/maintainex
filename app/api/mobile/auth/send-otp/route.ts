import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const { allowed } = checkRateLimit(ip, 3)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({ where: { phone } })
    if (!user) {
      return NextResponse.json({ success: true })
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const codeHash = await bcrypt.hash(code, 10)

    await prisma.oTP.create({
      data: {
        userId: user.id,
        codeHash,
        purpose: 'PHONE_VERIFICATION',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP] Code for ${phone}: ${code}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
