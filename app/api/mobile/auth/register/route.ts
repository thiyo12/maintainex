import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { getTrustedClientIp } from '@/lib/security/client-ip'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { checkRateLimit } from '@/lib/rate-limit'
import { isSyntheticCertAccount } from '@/lib/test-cert'
import { sendOtpSms } from '@/lib/sms'

const MAX_TASKER_SERVICES = 15

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

export async function POST(request: NextRequest) {
  try {
    const ip = getTrustedClientIp(request.headers)
    const userAgent = request.headers.get('user-agent') ?? ''
    const { allowed } = checkRateLimit(ip, 5)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const body = await request.json()
    const role = body?.role === 'TASKER'
      ? 'TASKER'
      : body?.role === 'COMPANY'
        ? 'COMPANY'
        : body?.role === 'CUSTOMER'
          ? 'CUSTOMER'
          : ''

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : ''
    const phone = normalizePhone(typeof body?.phone === 'string' ? body.phone : '')
    const fullDigits = phone.replace(/\D/g, '')
    const digits = fullDigits.slice(-9)
    const countryCode = typeof body?.countryCode === 'string' && /^[A-Za-z]{2,3}$/.test(body.countryCode)
      ? body.countryCode.toUpperCase()
      : 'LK'

    if (!role) {
      return NextResponse.json({ error: 'Choose Customer, Individual provider, or Company registration' }, { status: 400 })
    }
    if (name.length < 2) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }
    if (!phone || digits.length < 7) {
      return NextResponse.json({ error: 'Valid mobile number required' }, { status: 400 })
    }
    if (role === 'COMPANY' && companyName.length < 2) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (rawEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(rawEmail)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
    }

    const rawServiceJobIds: unknown[] = Array.isArray(body?.serviceJobIds) ? body.serviceJobIds : []
    const serviceJobIds: string[] = Array.from(
      new Set(rawServiceJobIds.filter((id): id is string => typeof id === 'string' && id.length > 0))
    )

    if (role === 'TASKER') {
      if (serviceJobIds.length === 0) {
        return NextResponse.json({ error: 'Select at least one service you can provide' }, { status: 400 })
      }
      if (serviceJobIds.length > MAX_TASKER_SERVICES) {
        return NextResponse.json({ error: `Select up to ${MAX_TASKER_SERVICES} services during registration` }, { status: 400 })
      }
    }

    const existingPhone = await prisma.user.findFirst({
      where: {
        OR: [
          { phone },
          { countryCode, phone: { endsWith: digits } },
        ],
      },
    })

    if (existingPhone?.phoneVerified) {
      if (!existingPhone.isActive) {
        return NextResponse.json(
          {
            error: 'This verified account is closed. Contact MaintainEX support if you need the account reviewed or restored.',
            code: 'ACCOUNT_CLOSED_REVIEW_REQUIRED',
          },
          { status: 409 },
        )
      }
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
    if (role === 'TASKER') {
      selectedJobs = await prisma.templateJob.findMany({
        where: {
          id: { in: serviceJobIds },
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
      if (selectedJobs.length !== serviceJobIds.length) {
        return NextResponse.json({ error: 'One or more selected services are unavailable' }, { status: 400 })
      }
    }

    const email = rawEmail || existingPhone?.email || `${fullDigits}@maintainex.pending`
    const isCertRegistration = isSyntheticCertAccount({ email, name, phone })
    const otp = isCertRegistration ? '000000' : randomInt(0, 1000000).toString().padStart(6, '0')
    const codeHash = await bcrypt.hash(otp, 10)

    const result = await prisma.$transaction(async (tx) => {
      const user = existingPhone
        ? await tx.user.update({
            where: { id: existingPhone.id },
            data: {
              name,
              phone,
              email,
              role,
              countryCode,
              isActive: true,
            },
          })
        : await tx.user.create({
            data: {
              name,
              phone,
              email,
              passwordHash: '',
              phoneVerified: false,
              role,
              countryCode,
            },
          })

      if (role === 'TASKER') {
        const categoryKeys = [...new Set(selectedJobs.flatMap(job => [job.category.id, job.category.slug].filter(Boolean) as string[]))]
        const profile = await tx.taskerProfile.upsert({
          where: { userId: user.id },
          update: {
            countryCode,
            skills: JSON.stringify(categoryKeys),
            verificationStatus: 'PENDING',
            isVerified: false,
            isOnline: false,
          },
          create: {
            userId: user.id,
            countryCode,
            skills: JSON.stringify(categoryKeys),
            verificationStatus: 'PENDING',
            isVerified: false,
            isOnline: false,
          },
        })

        await tx.taskerSkill.deleteMany({ where: { taskerId: profile.id } })
        for (const job of selectedJobs) {
          await tx.taskerSkill.create({
            data: {
              taskerId: profile.id,
              jobId: job.id,
              experienceYears: 0,
              experienceLevel: 1,
              hourlyRate: 0,
              fixedRate: 0,
              currency: job.currency || (countryCode === 'LK' ? 'LKR' : 'USD'),
              countryCode,
            },
          })
        }
      }

      if (role === 'COMPANY') {
        const profile = await tx.companyProfile.upsert({
          where: { userId: user.id },
          update: {
            companyName,
            countryCode,
          },
          create: {
            userId: user.id,
            companyName,
            services: '[]',
            serviceAreas: '[]',
            countryCode,
          },
        })

        const membership = await tx.teamMember.findFirst({
          where: { companyId: profile.id, userId: user.id },
          select: { id: true },
        })
        if (membership) {
          await tx.teamMember.update({
            where: { id: membership.id },
            data: { name, role: 'COMPANY_OWNER', status: 'ACTIVE' },
          })
        } else {
          await tx.teamMember.create({
            data: {
              companyId: profile.id,
              userId: user.id,
              name,
              role: 'COMPANY_OWNER',
              status: 'ACTIVE',
              skills: '[]',
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

    if (!isCertRegistration) {
      try {
        await sendOtpSms(phone, otp, countryCode)
      } catch (error) {
        logger.error('Registration SMS delivery failed', { err: error })
        return NextResponse.json({
          error: 'We could not send the SMS verification code. Please try again shortly.',
          code: 'SMS_DELIVERY_FAILED',
        }, { status: 503 })
      }
    }

    return NextResponse.json({
      requiresVerification: true,
      userId: result.id,
      user: { id: result.id, name: result.name, phone: result.phone, role: result.role },
      verificationChannel: isCertRegistration ? 'test' : 'sms',
      testMode: isCertRegistration,
    })
  } catch (error) {
    logger.error('Mobile registration failed unexpectedly', { err: error })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
