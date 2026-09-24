import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { checkRateLimit } from '@/lib/rate-limit/middleware'
import { sendOtpEmail } from '@/lib/email'
import { sendOtpSms } from '@/lib/sms'
import { isSyntheticCertAccount, isTestOtpAllowed } from '@/lib/test-cert'
import { refundEscrow, resolveProviderActor, type ActorType } from '@/lib/domain/job-lifecycle'
import { notifyJobCancelled } from '@/lib/notifications'

const cancelPurpose = (jobId: string) => `JOB_CANCEL:${jobId}`

async function resolveActor(jobId: string, customerId: string, userId: string): Promise<ActorType | null> {
  if (customerId === userId) return 'CUSTOMER'
  return resolveProviderActor(jobId, userId)
}

async function quoteNotificationUsers(jobId: string): Promise<string[]> {
  const quotes = await prisma.jobQuote.findMany({
    where: { jobId, status: { in: ['PENDING', 'ACCEPTED'] } },
    select: { providerId: true, providerType: true },
  })

  const recipients = new Set<string>()
  for (const quote of quotes) {
    if (quote.providerType === 'INDIVIDUAL') {
      recipients.add(quote.providerId)
      continue
    }
    const company = await prisma.companyProfile.findUnique({
      where: { id: quote.providerId },
      select: { userId: true },
    })
    if (company?.userId) recipients.add(company.userId)
  }
  return [...recipients]
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

    const body = await request.json()
    const action = typeof body.action === 'string' ? body.action : ''
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, title: true, status: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Completed jobs cannot be cancelled' }, { status: 409 })
    }
    if (job.status === 'CANCELLED') {
      return NextResponse.json({ success: true, alreadyCancelled: true })
    }

    const actorType = await resolveActor(jobId, job.customerId, user.id)
    if (!actorType) {
      return NextResponse.json({ error: 'Only the customer or accepted provider can cancel this job' }, { status: 403 })
    }

    const [workspace, activePin] = await Promise.all([
      prisma.jobWorkspace.findUnique({
        where: { jobId },
        select: { progressStatus: true },
      }),
      prisma.jobVerificationPin.findFirst({
        where: { jobId, status: 'ACTIVE' },
        orderBy: { version: 'desc' },
        select: { workStartVerifiedAt: true },
      }),
    ])

    const workStarted =
      !!activePin?.workStartVerifiedAt ||
      (!!workspace && workspace.progressStatus !== 'ACCEPTED')

    if (workStarted) {
      return NextResponse.json({
        error: 'Work has already started. Use the dispute/support flow instead of cancellation.',
        code: 'WORK_ALREADY_STARTED',
      }, { status: 409 })
    }

    if (action === 'REQUEST_OTP') {
      const rateLimit = await checkRateLimit(request, {
        policyName: 'OTP_SEND',
        keyPrefix: 'job_cancel_otp',
        identifier: user.id,
      })
      if (!rateLimit.allowed) return rateLimit.response!

      const synthetic = isSyntheticCertAccount(user)
      const otp = synthetic
        ? String(0).repeat(6)
        : randomInt(0, 1000000).toString().padStart(6, '0')
      const codeHash = await bcrypt.hash(otp, 10)

      await prisma.oTP.updateMany({
        where: { userId: user.id, purpose: cancelPurpose(jobId), isUsed: false },
        data: { isUsed: true },
      })

      await prisma.oTP.create({
        data: {
          userId: user.id,
          codeHash,
          purpose: cancelPurpose(jobId),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          metadata: {
            jobId,
            reason,
            ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown',
          },
        },
      })

      if (!synthetic) {
        if (user.phone) await sendOtpSms(user.phone, otp, user.countryCode)
        else if (user.email) await sendOtpEmail(user.email, otp)
        else return NextResponse.json({ error: 'No verified delivery destination is available.' }, { status: 400 })
      }

      return NextResponse.json({ success: true, expiresInSeconds: 300, testMode: synthetic })
    }

    if (action !== 'CONFIRM') {
      return NextResponse.json({ error: 'action must be REQUEST_OTP or CONFIRM' }, { status: 400 })
    }
    if (!code) return NextResponse.json({ error: 'Cancellation OTP is required' }, { status: 400 })

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId: user.id,
        purpose: cancelPurpose(jobId),
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!otpRecord) {
      return NextResponse.json({ error: 'No valid cancellation code found. Request a new one.' }, { status: 400 })
    }
    if (otpRecord.attempts >= 5) {
      await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 })
    }

    const valid = isTestOtpAllowed(user, code) || await bcrypt.compare(code, otpRecord.codeHash)
    if (!valid) {
      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      })
      return NextResponse.json({ error: 'Invalid cancellation code' }, { status: 400 })
    }

    const providerRecipients = await quoteNotificationUsers(jobId)
    const escrow = await prisma.jobEscrow.findFirst({
      where: { jobId, status: { in: ['PENDING_PAYMENT', 'PROTECTED', 'ON_HOLD'] } },
      select: { id: true },
    })

    let refundAmount = 0
    if (escrow) {
      const result = await refundEscrow(
        { jobId, actorId: user.id, actorType },
        jobId,
        { allowAcceptedProviderCancellation: actorType !== 'CUSTOMER' },
      )
      refundAmount = result.refundAmount
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.marketplaceJob.updateMany({
          where: { id: jobId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          data: { status: 'CANCELLED', isActive: false },
        })
        await tx.jobQuote.updateMany({
          where: { jobId, status: { in: ['PENDING', 'ACCEPTED'] } },
          data: { status: 'WITHDRAWN' },
        })
        await tx.jobWorkspace.deleteMany({ where: { jobId } })
      })
    }

    await Promise.all([
      prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } }),
      prisma.jobVerificationPin.updateMany({
        where: { jobId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      }),
      prisma.companyJobAssignment.updateMany({
        where: { jobId, status: { in: ['ASSIGNED', 'ACCEPTED'] } },
        data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason || 'Job cancelled before work start' },
      }),
    ])

    if (actorType === 'CUSTOMER') {
      await Promise.all(
        providerRecipients
          .filter((recipientId) => recipientId !== user.id)
          .map((recipientId) => notifyJobCancelled(jobId, recipientId, job.title, 'Customer')),
      )
    } else {
      await notifyJobCancelled(jobId, job.customerId, job.title, 'Provider')
    }

    return NextResponse.json({ success: true, status: 'CANCELLED', refundAmount })
  } catch (error: any) {
    console.error('Cancel job error:', error)
    const message = error?.message || 'Failed to cancel job'
    if (message.includes('refund') || message.includes('escrow') || message.includes('funds')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 })
  }
}
