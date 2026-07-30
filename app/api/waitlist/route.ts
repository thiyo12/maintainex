import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const { allowed } = checkRateLimit(ip, 5)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const { phone, email } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
    }

    if (!/^\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit phone number.' }, { status: 400 })
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
      }

      const existingEmail = await prisma.waitlistEntry.findUnique({ where: { email } })
      if (existingEmail) {
        return NextResponse.json({ error: 'This email is already registered.' }, { status: 409 })
      }
    }

    const existingPhone = await prisma.waitlistEntry.findUnique({ where: { phone } })
    if (existingPhone) {
      return NextResponse.json({ error: 'This phone number is already registered.' }, { status: 409 })
    }

    await prisma.waitlistEntry.create({
      data: {
        name: phone,
        phone,
        email: email || null,
        role: 'SEEKER',
      },
    })

    return NextResponse.json({ success: true, message: "You're on the waitlist!" })
  } catch (error) {
    console.error('Waitlist error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const count = await prisma.waitlistEntry.count()
    return NextResponse.json({ success: true, count })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
