import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { getTrustedClientIp } from '@/lib/security/client-ip'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { createMarketplaceAuthSession, buildAuthResponse } from '@/lib/auth/marketplace-session'
import { checkOtpSendLimit, checkOtpVerifyLimit } from '@/lib/rate-limit-db'
import { sendOtpEmail } from '@/lib/email'
import { sendOtpSms } from '@/lib/sms'
import { getInteractiveTestRole, INTERACTIVE_TEST_PHONES, isTestOtpAllowed, isSyntheticCertAccount, type InteractiveTestRole } from '@/lib/test-cert'
import { provisionInteractiveDemoMarketplace } from '@/lib/demo-marketplace'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function inferPhoneCountries(phoneDigits: string): string[] {
  if (phoneDigits.startsWith('94')) return ['LK']
  if (phoneDigits.startsWith('41')) return ['CH']
  if (phoneDigits.startsWith('49')) return ['DE']
  if (phoneDigits.startsWith('44')) return ['GB']
  if (phoneDigits.startsWith('91')) return ['IN']
  if (phoneDigits.startsWith('61')) return ['AU']
  if (phoneDigits.startsWith('1')) return ['CA', 'US']
  return []
}

async function findUserByIdentifier(identifier: string) {
  if (EMAIL_REGEX.test(identifier)) {
    return prisma.user.findUnique({ where: { email: identifier } })
  }

  const allDigits = identifier.replace(/\D/g, '')
  if (!allDigits) return null
  const normalized = `+${allDigits}`

  const exact = await prisma.user.findFirst({ where: { phone: normalized } })
  if (exact) return exact

  // Backward-compatible lookup for legacy locally-formatted numbers.
  const digits = allDigits.slice(-9)
  const countries = inferPhoneCountries(allDigits)
  return prisma.user.findFirst({
    where: {
      phone: { endsWith: digits },
      ...(countries.length > 0 ? { countryCode: { in: countries } } : {}),
    },
  })
}

async function ensureInteractiveDemoAccount(role: InteractiveTestRole) {
  const phone = INTERACTIVE_TEST_PHONES[role]
  const email = `demo.${role.toLowerCase()}@maintainex-test.lk`
  const name = role === 'CUSTOMER'
    ? 'MaintainEX Demo Customer'
    : role === 'TASKER'
      ? 'MaintainEX Demo Tasker'
      : 'MaintainEX Demo Owner'

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    })
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            email,
            name,
            phone,
            phoneVerified: true,
            role,
            countryCode: 'US',
            isActive: true,
            isSuspended: false,
            isBanned: false,
            ...(role === 'TASKER' ? { identityStatus: 'VERIFIED' } : {}),
          },
        })
      : await tx.user.create({
          data: {
            email,
            passwordHash: '',
            name,
            phone,
            phoneVerified: true,
            role,
            countryCode: 'US',
            isActive: true,
            ...(role === 'TASKER' ? { identityStatus: 'VERIFIED' } : {}),
          },
        })

    if (role === 'CUSTOMER') {
      await tx.customerProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, source: 'BETA_DEMO' },
      })
    }

    if (role === 'TASKER') {
      const sampleJob = await tx.templateJob.findFirst({
        where: { isActive: true, isCompanyOnly: false },
        orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          currency: true,
          category: { select: { id: true, slug: true } },
        },
      })
      const skillKeys = sampleJob
        ? [sampleJob.category.id, sampleJob.category.slug].filter(Boolean)
        : []

      const profile = await tx.taskerProfile.upsert({
        where: { userId: user.id },
        update: {
          skills: JSON.stringify(skillKeys),
          countryCode: 'US',
          verificationStatus: 'VERIFIED',
          isVerified: true,
          isOnline: true,
        },
        create: {
          userId: user.id,
          skills: JSON.stringify(skillKeys),
          countryCode: 'US',
          verificationStatus: 'VERIFIED',
          isVerified: true,
          isOnline: true,
        },
      })

      if (sampleJob) {
        await tx.taskerSkill.upsert({
          where: { taskerId_jobId: { taskerId: profile.id, jobId: sampleJob.id } },
          update: {},
          create: {
            taskerId: profile.id,
            jobId: sampleJob.id,
            experienceYears: 3,
            experienceLevel: 2,
            hourlyRate: 0,
            fixedRate: 0,
            currency: sampleJob.currency || 'USD',
            countryCode: 'US',
          },
        })
      }
    }

    if (role === 'COMPANY') {
      const profile = await tx.companyProfile.upsert({
        where: { userId: user.id },
        update: {
          companyName: 'MaintainEX Demo Company',
          countryCode: 'US',
          verificationStatus: 'VERIFIED',
          isVerified: true,
        },
        create: {
          userId: user.id,
          companyName: 'MaintainEX Demo Company',
          services: '[]',
          serviceAreas: '[]',
          countryCode: 'US',
          verificationStatus: 'VERIFIED',
          isVerified: true,
        },
      })

      const owner = await tx.teamMember.findFirst({
        where: { companyId: profile.id, userId: user.id },
        select: { id: true },
      })
      if (owner) {
        await tx.teamMember.update({
          where: { id: owner.id },
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

    return user
  })
}

function accountBlocked(user: any): NextResponse | null {
  if (!user.isActive) {
    return NextResponse.json({ error: 'Account deactivated' }, { status: 401 })
  }
  if (user.isSuspended && (!user.suspendedUntil || new Date(user.suspendedUntil) > new Date())) {
    return NextResponse.json({
      error: 'Account suspended',
      code: 'SUSPENDED',
      reason: user.suspensionReason || 'Your account has been suspended. Please contact support.',
      suspendedUntil: user.suspendedUntil?.toISOString() || null,
    }, { status: 403 })
  }
  if (user.isBanned) {
    return NextResponse.json({
      error: 'Account banned',
      code: 'BANNED',
      reason: user.banReason || 'Your account has been permanently banned.',
    }, { status: 403 })
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const ip = getTrustedClientIp(request.headers)
    const userAgent = request.headers.get('user-agent') ?? ''
    const body = await request.json()
    const emailId = typeof body.email === 'string' ? body.email.trim() : ''
    const phoneId = typeof body.phone === 'string' ? body.phone.trim() : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''

    const identifier = emailId || phoneId
    if (!identifier) {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 })
    }

    const interactiveRole = phoneId ? getInteractiveTestRole(phoneId) : null
    const user = interactiveRole
      ? await ensureInteractiveDemoAccount(interactiveRole)
      : await findUserByIdentifier(identifier)

    if (user && interactiveRole) {
      await provisionInteractiveDemoMarketplace(user.id, interactiveRole)
    }

    if (!user) {
      return NextResponse.json({ error: 'If an account exists, an OTP has been sent.' }, { status: 200 })
    }

    const blocked = accountBlocked(user)
    if (blocked) return blocked

    if (!user.phoneVerified && phoneId) {
      return NextResponse.json({
        error: 'Finish mobile number verification before signing in.',
        code: 'PHONE_NOT_VERIFIED',
      }, { status: 403 })
    }

    if (!code) {
      const phone = phoneId || user.phone || identifier
      if (!interactiveRole) {
        const { allowed, reason } = await checkOtpSendLimit(phone, ip)
        if (!allowed) {
          return NextResponse.json({ error: reason }, { status: 429 })
        }
      }

      const syntheticTest = isSyntheticCertAccount(user)
      const otp = syntheticTest
        ? '000000'
        : randomInt(0, 1000000).toString().padStart(6, '0')
      const codeHash = await bcrypt.hash(otp, 10)

      if (interactiveRole) {
        await prisma.oTP.updateMany({
          where: { userId: user.id, purpose: 'LOGIN', isUsed: false },
          data: { isUsed: true },
        })
      }

      await prisma.oTP.create({
        data: {
          userId: user.id,
          codeHash,
          purpose: 'LOGIN',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          metadata: { ip, userAgent },
        },
      })

      if (!syntheticTest) {
        try {
          if (phoneId) {
            if (!user.phone) {
              return NextResponse.json({ error: 'No mobile number is linked to this account.' }, { status: 400 })
            }
            await sendOtpSms(user.phone, otp, user.countryCode)
          } else if (user.email) {
            await sendOtpEmail(user.email, otp)
          } else {
            return NextResponse.json({ error: 'No verified delivery destination is available.' }, { status: 400 })
          }
        } catch (error) {
          logger.error('OTP delivery failed', { err: error, route: '/api/mobile/auth/otp-login', method: 'POST' })
          await prisma.oTP.updateMany({
            where: { userId: user.id, purpose: 'LOGIN', isUsed: false },
            data: { isUsed: true },
          })
          return NextResponse.json({
            error: phoneId
              ? 'We could not send the SMS code. Please try again shortly.'
              : 'We could not send the verification code. Please try again shortly.',
            code: 'OTP_DELIVERY_FAILED',
          }, { status: 503 })
        }
      }

      return NextResponse.json({
        success: true,
        channel: syntheticTest ? 'test' : (phoneId ? 'sms' : 'email'),
        testMode: syntheticTest,
      })
    }

    const { allowed: verifyAllowed, reason: verifyReason } = await checkOtpVerifyLimit(user.id)
    if (!verifyAllowed) {
      return NextResponse.json({ error: verifyReason }, { status: 429 })
    }

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId: user.id,
        purpose: 'LOGIN',
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      return NextResponse.json({ error: 'No valid code found. Request a new one.' }, { status: 400 })
    }

    if (otpRecord.attempts >= 5) {
      await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 })
    }

    const usedSyntheticTestOtp = isTestOtpAllowed(user, code)
    if (!usedSyntheticTestOtp) {
      const isValid = await bcrypt.compare(code, otpRecord.codeHash)
      if (!isValid) {
        const updated = await prisma.oTP.update({
          where: { id: otpRecord.id },
          data: { attempts: { increment: 1 } },
        })
        if (updated.attempts >= 5) {
          await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
          await prisma.securityAudit.create({
            data: {
              action: 'OTP_BRUTE_FORCE',
              category: 'AUTH',
              userId: user.id,
              userEmail: user.email,
              userRole: user.role,
              entityType: 'OTP',
              entityId: otpRecord.id,
              description: `5 failed OTP attempts for ${user.email || user.phone} from IP ${ip}`,
              ipAddress: ip,
              userAgent,
            },
          })
        }
        return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 })
      }
    }

    const consumed = await prisma.oTP.updateMany({
      where: { id: otpRecord.id, isUsed: false },
      data: { isUsed: true },
    })
    if (consumed.count !== 1) {
      return NextResponse.json({ error: 'This login code was already used. Request a new one.' }, { status: 409 })
    }

    if (usedSyntheticTestOtp && user.role === 'TASKER' && isSyntheticCertAccount(user)) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { identityStatus: 'VERIFIED', phoneVerified: true },
        })
        await tx.taskerProfile.updateMany({
          where: { userId: user.id },
          data: {
            verificationStatus: 'VERIFIED',
            isVerified: true,
            isOnline: true,
          },
        })
      })
    }

    const authSession = await createMarketplaceAuthSession(user.id, {
      ipAddress: ip,
      userAgent: userAgent || undefined,
    })
    const response = buildAuthResponse(authSession)

    return NextResponse.json({
      ...response,
      token: response.accessToken,
    })
  } catch (error) {
    logger.error('OTP login failed unexpectedly', { err: error, route: '/api/mobile/auth/otp-login', method: 'POST' })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
