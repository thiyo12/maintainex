import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { sendOtpSms } from '@/lib/sms'
import { sendOtpEmail } from '@/lib/email'
import { isSyntheticCertAccount, isTestOtpAllowed } from '@/lib/test-cert'
import { refundEscrow, resolveProviderActor, type ActorType } from '@/lib/domain/job-lifecycle'
import { notifyUser } from '@/lib/notifications'

const OTP_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

async function resolveCancellationActor(jobId: string, userId: string): Promise<ActorType | null> {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { customerId: true, status: true },
  })
  if (!job) return null
  if (job.customerId === userId) return 'CUSTOMER'
  return resolveProviderActor(jobId, userId)
}

async function assertCancellable(jobId: string, userId: string) {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { id: true, customerId: true, title: true, status: true, isActive: true },
  })
  if (!job) return { error: NextResponse.json({ error: 'Job not found' }, { status: 404 }) }
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
    return { error: NextResponse.json({ error: 'This job can no longer be cancelled' }, { status: 409 }) }
  }

  const actorType = await resolveCancellationActor(jobId, userId)
  if (!actorType) {
    return { error: NextResponse.json({ error: 'Only the customer or accepted provider can cancel this job' }, { status: 403 }) }
  }

  const pin = await prisma.jobVerificationPin.findFirst({
    where: { jobId, status: 'ACTIVE' },
    orderBy: { version: 'desc' },
    select: { workStartVerifiedAt: true },
  })
  if (pin?.workStartVerifiedAt) {
    return {
      error: NextResponse.json({
        error: 'Work has already started. Use the dispute/support flow instead of cancellation.',
        code: 'WORK_ALREADY_STARTED',
      }, { status: 409 }),
    }
  }

  return { job, actorType }
}

async function notifyCounterparty(jobId: string, cancelledBy: string, reason?: string) {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { customerId: true, title: true },
  })
  if (!job) return

  const quote = await prisma.jobQuote.findFirst({
    where: { jobId, status: { in: ['ACCEPTED', 'WITHDRAWN'] } },
    orderBy: { createdAt: 'desc' },
    select: { providerId: true, providerType: true },
  })

  const recipients = new Set<string>()
  if (job.customerId !== cancelledBy) recipients.add(job.customerId)

  if (quote?.providerType === 'INDIVIDUAL') {
    if (quote.providerId !== cancelledBy) recipients.add(quote.providerId)
  } else if (quote?.providerType === 'COMPANY') {
    const company = await prisma.companyProfile.findUnique({
      where: { id: quote.providerId },
      select: { userId: true },
    })
    if (company?.userId && company.userId !== cancelledBy) recipients.add(company.userId)
  }

  await Promise.all([...recipients].map(userId => notifyUser({
    userId,
    title: 'Job cancelled',
    body: reason
      ? `"${job.title}" was cancelled: ${reason.slice(0, 120)}`
      : `"${job.title}" was cancelled before work started.`,
    referenceType: 'JOB',
    referenceId: jobId,
    pushData: { type: 'JOB_CANCELLED', jobId },
    channelId: 'updates',
    priority: 'high',
  })))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const action = typeof body.action === 'string' ? body.action : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

    const cancellable = await assertCancellable(jobId, user.id)
    if ('error' in cancellable) return cancellable.error!

    const purpose = `JOB_CANCEL:${jobId}`

    if (action === 'REQUEST_OTP') {
      await prisma.oTP.updateMany({
        where: { userId: user.id, purpose, isUsed: false },
        data: { isUsed: true },
      })

      const synthetic = isSyntheticCertAccount(user)
      const code = synthetic ? '000000' : randomInt(0, 1_000_000).toString().padStart(6, '0')
      const codeHash = await bcrypt.hash(code, 10)

      await prisma.oTP.create({
        data: {
          userId: user.id,
          codeHash,
          purpose,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
          metadata: { jobId, reason, action: 'CANCEL_JOB' },
        },
      })

      if (!synthetic) {
        if (user.phone) await sendOtpSms(user.phone, code, user.countryCode)
        else if (user.email) await sendOtpEmail(user.email, code)
        else return NextResponse.json({ error: 'No verified OTP destination is available' }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        testMode: synthetic,
      })
    }

    if (action !== 'CONFIRM') {
      return NextResponse.json({ error: 'action must be REQUEST_OTP or CONFIRM' }, { status: 400 })
    }

    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'A valid 6-digit cancellation code is required' }, { status: 400 })
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
    if (!otp) return NextResponse.json({ error: 'No valid cancellation code found. Request a new one.' }, { status: 400 })
    if (otp.attempts >= MAX_ATTEMPTS) {
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
      if (updated.attempts >= MAX_ATTEMPTS) {
        await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })
      }
      return NextResponse.json({ error: 'Invalid cancellation code' }, { status: 400 })
    }

    await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })

    // Re-check after OTP verification to close any race with work start.
    const latest = await assertCancellable(jobId, user.id)
    if ('error' in latest) return latest.error!
    const { job, actorType } = latest

    let refundAmount = 0
    const escrow = await prisma.jobEscrow.findFirst({
      where: { jobId, status: { in: ['PENDING_PAYMENT', 'PROTECTED', 'ON_HOLD'] } },
      select: { id: true },
    })

    if (escrow) {
      const refund = await refundEscrow({ jobId, actorId: user.id, actorType }, jobId)
      refundAmount = refund.refundAmount
    } else {
      await prisma.$transaction(async tx => {
        await tx.marketplaceJob.update({
          where: { id: jobId },
          data: { status: 'CANCELLED', isActive: false },
        })
        await tx.jobQuote.updateMany({
          where: { jobId, status: { in: ['PENDING', 'ACCEPTED'] } },
          data: { status: 'WITHDRAWN' },
        })
      })
    }

    await notifyCounterparty(jobId, user.id, reason)

    return NextResponse.json({
      success: true,
      status: 'CANCELLED',
      refundAmount,
      message: job.status === 'OPEN'
        ? 'Job cancelled.'
        : 'Job cancelled before work start and any protected funds were returned.',
    })
  } catch (error) {
    console.error('Cancel job error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 })
  }
}
