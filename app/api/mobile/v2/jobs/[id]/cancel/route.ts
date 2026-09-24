import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { checkOtpSendLimit } from '@/lib/rate-limit-db'
import { sendOtpSms } from '@/lib/sms'
import { isSyntheticCertAccount, isTestOtpAllowed } from '@/lib/test-cert'
import { refundEscrow, resolveProviderActor, type ActorType } from '@/lib/domain/job-lifecycle'
import { notifyJobCancelled } from '@/lib/notifications'
import { emitSecurityEvent } from '@/lib/security/events'

function purposeFor(jobId: string) {
  return `JOB_CANCEL:${jobId}`
}

async function getCancellationContext(jobId: string, userId: string) {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      customerId: true,
      title: true,
      status: true,
      approvedQuoteId: true,
    },
  })
  if (!job) return { error: 'Job not found', status: 404 as const }

  if (!['OPEN', 'QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(job.status)) {
    return {
      error: 'This job cannot be cancelled in its current state.',
      status: 409 as const,
    }
  }

  const workspace = await prisma.jobWorkspace.findUnique({
    where: { jobId },
    select: { progressStatus: true },
  })
  const pin = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
    select: { workStartVerifiedAt: true },
  })

  if (
    workspace?.progressStatus === 'IN_PROGRESS' ||
    workspace?.progressStatus === 'COMPLETION_REQUESTED' ||
    pin?.workStartVerifiedAt
  ) {
    return {
      error: 'Work has already started. Use the dispute flow instead of cancellation.',
      status: 409 as const,
    }
  }

  if (job.customerId === userId) {
    return { job, actorType: 'CUSTOMER' as ActorType, actorLabel: 'customer' }
  }

  if (job.status === 'OPEN') {
    return { error: 'Only the customer can cancel an open job.', status: 403 as const }
  }

  const providerActor = await resolveProviderActor(jobId, userId)
  if (!providerActor) {
    return { error: 'Only the customer or accepted provider can cancel this job.', status: 403 as const }
  }

  return {
    job,
    actorType: providerActor,
    actorLabel: providerActor === 'COMPANY' ? 'company' : 'provider',
  }
}

async function resolveCounterparty(jobId: string, customerId: string, actorId: string) {
  if (actorId !== customerId) return customerId

  const accepted = await prisma.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (accepted?.providerType === 'INDIVIDUAL') return accepted.providerId
  if (accepted?.providerType === 'COMPANY') {
    const company = await prisma.companyProfile.findUnique({
      where: { id: accepted.providerId },
      select: { userId: true },
    })
    return company?.userId || null
  }

  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { targetTaskerId: true },
  })
  if (!job?.targetTaskerId) return null

  const tasker = await prisma.taskerProfile.findFirst({
    where: {
      OR: [
        { id: job.targetTaskerId },
        { userId: job.targetTaskerId },
      ],
    },
    select: { userId: true },
  })
  return tasker?.userId || null
}

async function cancelWithoutEscrow(jobId: string) {
  await prisma.$transaction(async tx => {
    await tx.marketplaceJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', isActive: false },
    })
    await tx.jobQuote.updateMany({
      where: { jobId, status: { in: ['PENDING', 'ACCEPTED'] } },
      data: { status: 'WITHDRAWN' },
    })
    await tx.providerOpportunity.updateMany({
      where: { jobId, status: { in: ['PENDING', 'SENT', 'VIEWED', 'ACCEPTED'] } },
      data: { status: 'CANCELLED' },
    })
    await tx.jobMatchQueue.updateMany({
      where: { jobId },
      data: { status: 'cancelled' },
    })
    await tx.jobWorkspace.deleteMany({ where: { jobId } })
    await tx.jobVerificationPin.updateMany({
      where: { jobId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    })
  })
}

async function finalizeCancellation(jobId: string) {
  await prisma.$transaction(async tx => {
    await tx.marketplaceJob.updateMany({
      where: { id: jobId, status: 'CANCELLED' },
      data: { isActive: false },
    })
    await tx.providerOpportunity.updateMany({
      where: { jobId, status: { in: ['PENDING', 'SENT', 'VIEWED', 'ACCEPTED'] } },
      data: { status: 'CANCELLED' },
    })
    await tx.jobMatchQueue.updateMany({
      where: { jobId },
      data: { status: 'cancelled' },
    })
    await tx.jobWorkspace.deleteMany({ where: { jobId } })
    await tx.jobVerificationPin.updateMany({
      where: { jobId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    })
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(auth)
    if (blocked) return blocked

    const { id: jobId } = await params
    const body = await request.json().catch(() => ({}))
    const action = typeof body?.action === 'string' ? body.action : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

    const context = await getCancellationContext(jobId, auth.id)
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: {
        id: true,
        phone: true,
        countryCode: true,
        email: true,
        role: true,
        isActive: true,
        isSuspended: true,
        isBanned: true,
      },
    })
    if (!user?.phone) {
      return NextResponse.json({ error: 'A verified mobile number is required to cancel a job.' }, { status: 400 })
    }

    const otpPurpose = purposeFor(jobId)

    if (action === 'REQUEST_CODE') {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown'
      const synthetic = isSyntheticCertAccount(user)

      if (!synthetic) {
        const limit = await checkOtpSendLimit(user.phone, ip)
        if (!limit.allowed) {
          return NextResponse.json(
            { error: limit.reason },
            {
              status: 429,
              headers: limit.retryAfter ? { 'Retry-After': String(limit.retryAfter) } : undefined,
            },
          )
        }
      }

      const otp = synthetic ? '000000' : randomInt(0, 1_000_000).toString().padStart(6, '0')
      const codeHash = await bcrypt.hash(otp, 10)

      await prisma.$transaction(async tx => {
        await tx.oTP.updateMany({
          where: { userId: user.id, purpose: otpPurpose, isUsed: false },
          data: { isUsed: true },
        })
        await tx.oTP.create({
          data: {
            userId: user.id,
            codeHash,
            purpose: otpPurpose,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            metadata: { ip, jobId, action: 'JOB_CANCEL' },
          },
        })
      })

      if (!synthetic) {
        try {
          await sendOtpSms(user.phone, otp, user.countryCode)
        } catch (error) {
          await prisma.oTP.updateMany({
            where: { userId: user.id, purpose: otpPurpose, isUsed: false },
            data: { isUsed: true },
          })
          console.error('Cancellation OTP delivery failed:', error)
          return NextResponse.json({
            error: 'We could not send the cancellation code. Please try again shortly.',
            code: 'OTP_DELIVERY_FAILED',
          }, { status: 503 })
        }
      }

      emitSecurityEvent({
        type: 'job_cancel_otp_requested',
        actorId: user.id,
        actorType: 'user',
        details: { jobId, actorRole: context.actorType },
      })

      return NextResponse.json({
        success: true,
        channel: synthetic ? 'test' : 'sms',
        testMode: synthetic,
      })
    }

    if (action !== 'CONFIRM') {
      return NextResponse.json({ error: 'action must be REQUEST_CODE or CONFIRM' }, { status: 400 })
    }
    if (!/^d{6}$/.test(code)) {
      return NextResponse.json({ error: 'A valid 6-digit cancellation code is required.' }, { status: 400 })
    }

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId: user.id,
        purpose: otpPurpose,
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

    const syntheticValid = isTestOtpAllowed(user, code)
    const valid = syntheticValid || await bcrypt.compare(code, otpRecord.codeHash)
    if (!valid) {
      const updated = await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      })
      if (updated.attempts >= 5) {
        await prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
      }
      return NextResponse.json({ error: 'Invalid cancellation code.' }, { status: 400 })
    }

    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    })

    const escrow = await prisma.jobEscrow.findFirst({
      where: {
        jobId,
        status: { in: ['PENDING_PAYMENT', 'PROTECTED', 'ON_HOLD'] },
      },
      select: { id: true },
    })

    if (escrow) {
      await refundEscrow(
        {
          jobId,
          actorId: user.id,
          actorType: context.actorType,
          reason: reason || 'Cancelled before work start',
        },
        jobId,
      )
      await finalizeCancellation(jobId)
    } else {
      await cancelWithoutEscrow(jobId)
    }

    const counterpartyId = await resolveCounterparty(jobId, context.job.customerId, user.id)
    if (counterpartyId) {
      await notifyJobCancelled(
        jobId,
        counterpartyId,
        context.job.title,
        context.actorLabel,
      )
    }

    emitSecurityEvent({
      type: 'job_cancelled_with_otp',
      actorId: user.id,
      actorType: 'user',
      details: {
        jobId,
        actorRole: context.actorType,
        reason: reason || null,
      },
    })

    return NextResponse.json({
      success: true,
      status: 'CANCELLED',
      refunded: Boolean(escrow),
    })
  } catch (error: any) {
    console.error('Job cancellation error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('refund') || message.includes('Cannot') || message.includes('cannot')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
