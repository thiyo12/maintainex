import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { checkRateLimit } from '@/lib/rate-limit'
import { CERT_TAG } from '@/lib/test-cert'
import { sendOtpSms } from '@/lib/sms'

const MAX_TASKER_SERVICES = 15

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

function validDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed >= new Date()) return null
  return parsed
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') ?? ''
    const { allowed } = checkRateLimit(ip, 5)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const role = body?.role === 'TASKER' ? 'TASKER' : body?.role === 'CUSTOMER' ? 'CUSTOMER' : ''
    const phone = normalizePhone(typeof body?.phone === 'string' ? body.phone : '')
    const fullDigits = phone.replace(/\D/g, '')
    const digits = fullDigits.slice(-9)
    const countryCode = typeof body?.countryCode === 'string' && /^[A-Za-z]{2,3}$/.test(body.countryCode)
      ? body.countryCode.toUpperCase()
      : 'LK'

    if (!role) {
      return NextResponse.json({ error: 'Choose Customer or Tasker registration' }, { status: 400 })
    }
    if (!phone || digits.length < 7) {
      return NextResponse.json({ error: 'Valid mobile number required' }, { status: 400 })
    }

    const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (rawEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(rawEmail)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
    }

    let taskerInput: {
      name: string
      dateOfBirth: Date
      address: string
      experienceYears: number
      experienceSummary: string
      serviceJobIds: string[]
    } | null = null

    if (role === 'TASKER') {
      const name = typeof body?.name === 'string' ? body.name.trim() : ''
      const dateOfBirth = validDate(typeof body?.dateOfBirth === 'string' ? body.dateOfBirth.trim() : '')
      const address = typeof body?.address === 'string' ? body.address.trim() : ''
      const experienceYears = Number(body?.experienceYears)
      const experienceSummary = typeof body?.experienceSummary === 'string' ? body.experienceSummary.trim() : ''
      const rawServiceJobIds: unknown[] = Array.isArray(body?.serviceJobIds) ? body.serviceJobIds : []
      const serviceJobIds: string[] = Array.from(
        new Set(rawServiceJobIds.filter((id): id is string => typeof id === 'string' && id.length > 0))
      )

      if (name.length < 2) return NextResponse.json({ error: 'Full legal name is required' }, { status: 400 })
      if (!dateOfBirth) return NextResponse.json({ error: 'Valid date of birth is required' }, { status: 400 })
      if (address.length < 5) return NextResponse.json({ error: 'Full address is required' }, { status: 400 })
      if (!Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 60) {
        return NextResponse.json({ error: 'Work experience must be between 0 and 60 years' }, { status: 400 })
      }
      if (experienceSummary.length < 10) {
        return NextResponse.json({ error: 'Tell us briefly about your work experience' }, { status: 400 })
      }
      if (serviceJobIds.length === 0) {
        return NextResponse.json({ error: 'Select at least one service you can provide' }, { status: 400 })
      }
      if (serviceJobIds.length > MAX_TASKER_SERVICES) {
        return NextResponse.json({ error: `Select up to ${MAX_TASKER_SERVICES} services during registration` }, { status: 400 })
      }

      taskerInput = { name, dateOfBirth, address, experienceYears, experienceSummary, serviceJobIds }
    }

    const existingPhone = await prisma.user.findFirst({
      where: {
        OR: [
          { phone },
          { countryCode, phone: { endsWith: digits } },
        ],
      },
      include: { taskerProfile: true },
    })

    if (existingPhone?.phoneVerified) {
      return NextResponse.json({ error: 'Mobile number already registered. Sign in with OTP.' }, { status: 409 })
    }
    if (existingPhone && existingPhone.role !== role) {
      return NextResponse.json({ error: 'This mobile number already has an unfinished registration with another account type.' }, { status: 409 })
    }

    if (rawEmail) {
      const existingEmail = await prisma.user.findUnique({ where: { email: rawEmail } })
      if (existingEmail && existingEmail.id !== existingPhone?.id) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
      }
    }

    let selectedJobs: Array<{ id: string; categoryId: string; currency: string; category: { id: string; slug: string | null } }> = []
    if (taskerInput) {
      selectedJobs = await prisma.templateJob.findMany({
        where: {
          id: { in: taskerInput.serviceJobIds },
          isActive: true,
          isCompanyOnly: false,
        },
        select: {
          id: true,
          categoryId: true,
          currency: true,
          category: { select: { id: true, slug: true } },
        },
      })
      if (selectedJobs.length !== taskerInput.serviceJobIds.length) {
        return NextResponse.json({ error: 'One or more selected services are unavailable' }, { status: 400 })
      }
    }

    const displayName = role === 'TASKER'
      ? taskerInput!.name
      : (typeof body?.name === 'string' && body.name.trim().length >= 2 ? body.name.trim() : `Customer ${digits.slice(-4)}`)

    const email = rawEmail || existingPhone?.email || `${fullDigits}@maintainex.pending`
    const isCertRegistration = process.env.ALLOW_TEST_OTP === 'true' &&
      [email, displayName, phone].some(value => value.includes(CERT_TAG))
    const otp = isCertRegistration ? '000000' : randomInt(0, 1000000).toString().padStart(6, '0')
    const codeHash = await bcrypt.hash(otp, 10)

    const result = await prisma.$transaction(async (tx) => {
      const user = existingPhone
        ? await tx.user.update({
            where: { id: existingPhone.id },
            data: {
              name: displayName,
              phone,
              email,
              role,
              countryCode,
              isActive: true,
            },
          })
        : await tx.user.create({
            data: {
              name: displayName,
              phone,
              email,
              passwordHash: '',
              phoneVerified: false,
              role,
              countryCode,
            },
          })

      if (role === 'TASKER' && taskerInput) {
        const categoryKeys = [...new Set(selectedJobs.flatMap(job => [job.category.id, job.category.slug].filter(Boolean) as string[]))]
        const profile = await tx.taskerProfile.upsert({
          where: { userId: user.id },
          update: {
            bio: taskerInput.experienceSummary,
            dateOfBirth: taskerInput.dateOfBirth,
            address: taskerInput.address,
            countryCode,
            skills: JSON.stringify(categoryKeys),
            verificationStatus: 'PENDING',
            isVerified: false,
            isOnline: false,
          },
          create: {
            userId: user.id,
            bio: taskerInput.experienceSummary,
            dateOfBirth: taskerInput.dateOfBirth,
            address: taskerInput.address,
            countryCode,
            skills: JSON.stringify(categoryKeys),
            verificationStatus: 'PENDING',
            isVerified: false,
            isOnline: false,
          },
        })

        await tx.taskerSkill.deleteMany({ where: { taskerId: profile.id } })
        const experienceLevel = taskerInput.experienceYears >= 5 ? 3 : taskerInput.experienceYears >= 2 ? 2 : 1
        for (const job of selectedJobs) {
          await tx.taskerSkill.create({
            data: {
              taskerId: profile.id,
              jobId: job.id,
              experienceYears: taskerInput.experienceYears,
              experienceLevel,
              hourlyRate: 0,
              fixedRate: 0,
              currency: job.currency || (countryCode === 'LK' ? 'LKR' : 'USD'),
              countryCode,
            },
          })
        }
      }

      await tx.oTP.updateMany({
        where: { userId: user.id, purpose: 'PHONE_VERIFICATION', isUsed: false },
        data: { isUsed: true },
      })
      await tx.oTP.create({
        data: {
          userId: user.id,
          codeHash,
          purpose: 'PHONE_VERIFICATION',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          metadata: { ip, userAgent },
        },
      })

      return user
    })

    try {
      await sendOtpSms(phone, otp)
    } catch (error) {
      console.error('Registration SMS error:', error)
      return NextResponse.json({
        error: 'We could not send the SMS verification code. Please try again shortly.',
        code: 'SMS_DELIVERY_FAILED',
      }, { status: 503 })
    }

    return NextResponse.json({
      requiresVerification: true,
      userId: result.id,
      user: { id: result.id, name: result.name, phone: result.phone, role: result.role },
      verificationChannel: 'sms',
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
