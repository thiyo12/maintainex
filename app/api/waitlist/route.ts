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

    const { name, phone, email, role } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
    }

    const digitsOnly = phone.replace(/\D/g, '')
    if (digitsOnly.length < 10 || digitsOnly.length > 12) {
      return NextResponse.json({ error: 'Please enter a valid phone number with country code.' }, { status: 400 })
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

    const validRoles = ['SEEKER', 'TASKER', 'AGENCY']
    const entryRole = validRoles.includes(role) ? role : 'SEEKER'

    await prisma.waitlistEntry.create({
      data: {
        name: name.trim(),
        phone,
        email: email || null,
        role: entryRole,
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
