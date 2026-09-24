import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveProviderActor, refundEscrow, type ActorType } from '@/lib/domain/job-lifecycle'
import { sendOtpSms } from '@/lib/sms'
import { isSyntheticCertAccount, isTestOtpAllowed } from '@/lib/test-cert'
import { createAndPushNotification } from '@/lib/notifications'

const PURPOSE_PREFIX = 'JOB_CANCEL:'
const MAX_REQUESTS_PER_HOUR = 3
const MAX_ATTEMPTS = 5

async function resolveParticipant(jobId: string, userId: string): Promise<{ actorType: ActorType; customerId: string } | null> {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { customerId: true },
  })
  if (!job) return null
  if (job.customerId === userId) return { actorType: 'CUSTOMER', customerId: job.customerId }

  const providerActor = await resolveProviderActor(jobId, userId)
  if (providerActor === 'PROVIDER' || providerActor === 'COMPANY') {
    return { actorType: providerActor, customerId: job.customerId }
  }
  return null
}

async function assertPreStart(jobId: string) {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  })
  if (!job) throw new Error('JOB_NOT_FOUND')
  if (['COMPLETED', 'CANCELLED'].includes(job.status)) throw new Error('JOB_TERMINAL')

  const workspace = await prisma.jobWorkspace.findUnique({
    where: { jobId },
    select: { progressStatus: true },
  })
  if (workspace && workspace.progressStatus !== 'ACCEPTED') {
    throw new Error('WORK_ALREADY_STARTED')
  }
}

async function resolveOtherParticipant(jobId: string, actorId: string, customerId: string): Promise<string | null> {
  if (actorId !== customerId) return customerId

  const accepted = await prisma.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!accepted) return null
  if (accepted.providerType === 'INDIVIDUAL') return accepted.providerId

  const company = await prisma.companyProfile.findUnique({
    where: { id: accepted.providerId },
    select: { userId: true },
  })
  return company?.userId || null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id } = await params
    const participant = await resolveParticipant(id, user.id)
    if (!participant) return NextResponse.json({ error: 'Not a participant in this job' }, { status: 403 })

    try {
      await assertPreStart(id)
    } catch (error: any) {
      if (error?.message === 'JOB_NOT_FOUND') return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      if (error?.message === 'JOB_TERMINAL') return NextResponse.json({ error: 'Job is already closed' }, { status: 409 })
      if (error?.message === 'WORK_ALREADY_STARTED') {
        return NextResponse.json({
          error: 'Cancellation is unavailable after work starts. Use dispute/support instead.',
        }, { status: 409 })
      }
      throw error
    }

    const body = await request.json()
    const action = typeof body.action === 'string' ? body.action : ''
    const purpose = `${PURPOSE_PREFIX}${id}`

    if (action === 'REQUEST_CODE' || action === 'REQUEST_OTP') {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const requestCount = await prisma.oTP.count({
        where: { userId: user.id, purpose, createdAt: { gte: hourAgo } },
      })
      if (requestCount >= MAX_REQUESTS_PER_HOUR) {
        return NextResponse.json({ error: 'Too many cancellation codes requested. Try again later.' }, { status: 429 })
      }
      if (!user.phone) {
        return NextResponse.json({ error: 'A verified mobile number is required to cancel this job.' }, { status: 400 })
      }

      const synthetic = isSyntheticCertAccount(user)
      const code = synthetic ? '000000' : randomInt(0, 1_000_000).toString().padStart(6, '0')
      const codeHash = await bcrypt.hash(code, 10)

      await prisma.oTP.updateMany({
        where: { userId: user.id, purpose, isUsed: false },
        data: { isUsed: true },
      })
      await prisma.oTP.create({
        data: {
          userId: user.id,
          purpose,
          codeHash,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          metadata: { jobId: id, action: 'CANCEL_JOB' },
        },
      })

      if (!synthetic) {
        await sendOtpSms(user.phone, code, user.countryCode)
      }

      return NextResponse.json({
        success: true,
        channel: synthetic ? 'test' : 'sms',
        testMode: synthetic,
        expiresInSeconds: 300,
      })
    }

    if (action !== 'CONFIRM') {
      return NextResponse.json({ error: 'action must be REQUEST_OTP or CONFIRM' }, { status: 400 })
    }

    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit cancellation code.' }, { status: 400 })
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
    if (!otp) return NextResponse.json({ error: 'No valid cancellation code found. Request a new code.' }, { status: 400 })
    if (otp.attempts >= MAX_ATTEMPTS) {
      await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })
      return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 })
    }

    const valid = isTestOtpAllowed(user, code) || await bcrypt.compare(code, otp.codeHash)
    if (!valid) {
      const updated = await prisma.oTP.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      })
      if (updated.attempts >= MAX_ATTEMPTS) {
        await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })
      }
      return NextResponse.json({ error: 'Invalid cancellation code.' }, { status: 400 })
    }
    await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })

    const escrow = await prisma.jobEscrow.findFirst({
      where: { jobId: id, status: { in: ['PENDING_PAYMENT', 'PROTECTED', 'ON_HOLD'] } },
      select: { id: true },
    })

    let refundAmount = 0
    if (escrow) {
      const refund = await refundEscrow(
        { jobId: id, actorId: user.id, actorType: participant.actorType },
        id,
        { allowAcceptedProviderCancellation: participant.actorType === 'PROVIDER' || participant.actorType === 'COMPANY' },
      )
      refundAmount = Number(refund.refundAmount || 0)
    } else {
      await prisma.$transaction(async tx => {
        await tx.marketplaceJob.update({
          where: { id },
          data: { status: 'CANCELLED', isActive: false },
        })
        await tx.jobQuote.updateMany({
          where: { jobId: id, status: { in: ['PENDING', 'ACCEPTED'] } },
          data: { status: 'WITHDRAWN' },
        })
        await tx.jobVerificationPin.updateMany({
          where: { jobId: id, status: 'ACTIVE' },
          data: { status: 'REVOKED', revokedAt: new Date() },
        })
        await tx.jobWorkspace.deleteMany({ where: { jobId: id } })
      })
    }

    const recipientId = await resolveOtherParticipant(id, user.id, participant.customerId)
    if (recipientId) {
      await createAndPushNotification({
        userId: recipientId,
        title: 'Job cancelled',
        body: 'The job was cancelled before work started.',
        referenceType: 'JOB',
        referenceId: id,
        pushData: { type: 'JOB_CANCELLED', jobId: id },
        pushOptions: { priority: 'high', sound: 'default' },
      })
    }

    return NextResponse.json({ success: true, status: 'CANCELLED', refundAmount })
  } catch (error) {
    console.error('Cancel job error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
