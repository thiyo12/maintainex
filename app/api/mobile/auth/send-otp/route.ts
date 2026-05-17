import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({ where: { phone } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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

    const returnDevCode = process.env.NODE_ENV !== 'production' || process.env.OTP_DEV_MODE === 'true'
    if (returnDevCode) console.log(`[OTP] Code for ${phone}: ${code}`)

    return NextResponse.json({
      success: true,
      ...(returnDevCode ? { devCode: code } : {}),
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
