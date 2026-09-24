import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { sendOtpSms } from '@/lib/sms'
import { sendOtpEmail } from '@/lib/email'
import { isSyntheticCertAccount, isTestOtpAllowed } from '@/lib/test-cert'
import { checkOtpSendLimit, checkOtpVerifyLimit } from '@/lib/rate-limit-db'
import { cancelJobBeforeWorkStart, resolveProviderActor, type ActorType } from '@/lib/domain/job-lifecycle'
import { notifyJobCancelled } from '@/lib/notifications'

const PURPOSE_PREFIX = 'JOB_CANCEL:'

async function resolveCancellationContext(jobId: string, userId: string) {
  const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
  if (!job) return { error: NextResponse.json({ error: 'Job not found' }, { status: 404 }) }

  if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
    return { error: NextResponse.json({ error: 'Job cannot be cancelled in its current status' }, { status: 409 }) }
  }

  const [workspace, pinState, acceptedQuote] = await Promise.all([
    prisma.jobWorkspace.findUnique({ where: { jobId }, select: { progressStatus: true } }),
    prisma.jobVerificationPin.findFirst({
      where: { jobId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
      select: { workStartVerifiedAt: true },
    }),
    prisma.jobQuote.findFirst({
      where: { jobId, status: 'ACCEPTED' },
      select: { providerId: true, providerType: true },
    }),
  ])

  if (pinState?.workStartVerifiedAt || (workspace && workspace.progressStatus !== 'ACCEPTED')) {
    return {
      error: NextResponse.json({
        error: 'Work has already started. Use dispute/support instead of cancellation.',
        code: 'WORK_ALREADY_STARTED',
      }, { status: 409 }),
    }
  }

  let actorType: ActorType
  if (job.customerId === userId) {
    actorType = 'CUSTOMER'
  } else {
    const providerActor = await resolveProviderActor(jobId, userId)
    if (!providerActor) {
      return { error: NextResponse.json({ error: 'You are not part of this job' }, { status: 403 }) }
    }
    actorType = providerActor
  }

  return { job, actorType, acceptedQuote }
}

async function providerNotificationUser(providerId: string, providerType: string): Promise<string | null> {
  if (providerType === 'INDIVIDUAL') return providerId
  const company = await prisma.companyProfile.findUnique({
    where: { id: providerId },
    select: { userId: true },
  })
  return company?.userId || null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const context = await resolveCancellationContext(jobId, user.id)
    if ('error' in context) return context.error

    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
    const purpose = `${PURPOSE_PREFIX}${jobId}`
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'
    const synthetic = isSyntheticCertAccount(user)

    if (action === 'REQUEST_OTP') {
      const destination = user.phone || user.email
      if (!destination) {
        return NextResponse.json({ error: 'No verified OTP destination is available.' }, { status: 400 })
      }

      if (!synthetic && user.phone) {
        const limit = await checkOtpSendLimit(user.phone, ip)
        if (!limit.allowed) {
          return NextResponse.json({ error: limit.reason, retryAfter: limit.retryAfter }, { status: 429 })
        }
      }

      await prisma.oTP.updateMany({
        where: { userId: user.id, purpose, isUsed: false },
        data: { isUsed: true },
      })

      const code = synthetic ? '000000' : randomInt(0, 1_000_000).toString().padStart(6, '0')
      const codeHash = await bcrypt.hash(code, 10)
      await prisma.oTP.create({
        data: {
          userId: user.id,
          codeHash,
          purpose,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          metadata: { ip, jobId, action: 'JOB_CANCEL' },
        },
      })

      if (!synthetic) {
        try {
          if (user.phone) {
            await sendOtpSms(user.phone, code, user.countryCode)
          } else if (user.email) {
            const delivered = await sendOtpEmail(user.email, code)
            if (!delivered) throw new Error('Email OTP delivery failed')
          }
        } catch (error) {
          console.error('Cancellation OTP delivery failed:', error)
          await prisma.oTP.updateMany({
            where: { userId: user.id, purpose, isUsed: false },
            data: { isUsed: true },
          })
          return NextResponse.json({ error: 'Unable to send cancellation code right now.' }, { status: 503 })
        }
      }

      return NextResponse.json({
        success: true,
        testMode: synthetic,
        channel: synthetic ? 'test' : (user.phone ? 'sms' : 'email'),
      })
    }

    if (action !== 'CONFIRM') {
      return NextResponse.json({ error: 'action must be REQUEST_OTP or CONFIRM' }, { status: 400 })
    }

    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'A valid 6-digit code is required' }, { status: 400 })
    }

    const verifyLimit = await checkOtpVerifyLimit(user.id)
    if (!verifyLimit.allowed) {
      return NextResponse.json({ error: verifyLimit.reason }, { status: 429 })
    }

    const otp = await prisma.oTP.findFirst({
      where: {
        userId: user.id,
        purpose,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp) {
      return NextResponse.json({ error: 'No valid cancellation code found. Request a new one.' }, { status: 400 })
    }
    if (otp.attempts >= 5) {
      await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 })
    }

    const testAllowed = isTestOtpAllowed(user, code)
    const valid = testAllowed || await bcrypt.compare(code, otp.codeHash)
    if (!valid) {
      const updated = await prisma.oTP.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      })
      if (updated.attempts >= 5) {
        await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })
      }
      return NextResponse.json({ error: 'Invalid cancellation code.' }, { status: 400 })
    }

    await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })

    const result = await cancelJobBeforeWorkStart(
      {
        jobId,
        actorId: user.id,
        actorType: context.actorType!,
        reason,
      },
      jobId,
      reason,
    )

    const recipients = new Set<string>()
    if (context.actorType === 'CUSTOMER') {
      if (context.acceptedQuote) {
        const recipient = await providerNotificationUser(
          context.acceptedQuote.providerId,
          context.acceptedQuote.providerType,
        )
        if (recipient) recipients.add(recipient)
      }
    } else {
      recipients.add(context.job!.customerId)
    }

    await Promise.all(
      [...recipients].map(recipient =>
        notifyJobCancelled(
          jobId,
          recipient,
          context.job!.title,
          context.actorType as 'CUSTOMER' | 'PROVIDER' | 'COMPANY',
        )
      )
    )

    return NextResponse.json({
      success: true,
      status: 'CANCELLED',
      refundAmount: result.refundAmount,
    })
  } catch (error: any) {
    console.error('Cancel job error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('started')) return NextResponse.json({ error: message }, { status: 409 })
    if (message.includes('participant') || message.includes('Only the customer')) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    return NextResponse.json({ error: 'Unable to cancel job' }, { status: 500 })
  }
}
