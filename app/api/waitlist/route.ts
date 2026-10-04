import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, ipKey } from '@/lib/rate-limit/middleware'

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(request, {
      policyName: 'PUBLIC_SUBMISSION',
      keyPrefix: 'waitlist_submission',
      identifier: ipKey(request),
    })
    if (!rateLimit.allowed) return rateLimit.response!

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

    const normalizedEmail = typeof email === 'string' && email.trim()
      ? email.trim().toLowerCase().slice(0, 320)
      : null
    if (normalizedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(normalizedEmail)) {
        return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
      }
    }

    const normalizedPhone = `+${digitsOnly}`
    const existing = await prisma.waitlistEntry.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ success: true, message: "You're on the waitlist!" })
    }

    const validRoles = ['SEEKER', 'TASKER', 'AGENCY']
    const entryRole = validRoles.includes(role) ? role : 'SEEKER'

    await prisma.waitlistEntry.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        email: normalizedEmail,
        role: entryRole,
      },
    })

    return NextResponse.json({ success: true, message: "You're on the waitlist!" })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: true, message: "You're on the waitlist!" })
    }
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
