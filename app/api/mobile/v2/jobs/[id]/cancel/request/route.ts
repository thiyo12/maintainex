import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveProviderActor } from '@/lib/domain/job-lifecycle'
import { checkOtpSendLimit } from '@/lib/rate-limit-db'
import { isSyntheticCertAccount } from '@/lib/test-cert'
import { sendOtpSms } from '@/lib/sms'

function purposeFor(jobId: string) {
  return `JOB_CANCEL:${jobId}`
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const { id: jobId } = await params
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, status: true },
    })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
      return NextResponse.json({ error: 'This job can no longer be cancelled' }, { status: 409 })
    }

    const activePin = await prisma.jobVerificationPin.findFirst({
      where: { jobId, status: 'ACTIVE' },
      orderBy: { version: 'desc' },
      select: { workStartVerifiedAt: true },
    })
    const workspace = await prisma.jobWorkspace.findUnique({
      where: { jobId },
      select: { progressStatus: true },
    })
    if (activePin?.workStartVerifiedAt || (workspace && workspace.progressStatus !== 'ACCEPTED')) {
      return NextResponse.json({
        error: 'Work has already started. Use dispute/support instead of cancellation.',
        code: 'WORK_ALREADY_STARTED',
      }, { status: 409 })
    }

    const isCustomer = job.customerId === user.id
    const providerActor = isCustomer ? null : await resolveProviderActor(jobId, user.id)
    if (!isCustomer && !providerActor) {
      return NextResponse.json({ error: 'Only the customer or accepted provider can cancel this job' }, { status: 403 })
    }

    if (!user.phone) {
      return NextResponse.json({ error: 'A verified mobile number is required for cancellation.' }, { status: 400 })
    }

    const synthetic = isSyntheticCertAccount(user)
    if (!synthetic) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
      const { allowed, reason } = await checkOtpSendLimit(user.phone, ip)
      if (!allowed) return NextResponse.json({ error: reason }, { status: 429 })
    }

    const otp = synthetic ? '000000' : randomInt(0, 1000000).toString().padStart(6, '0')
    const codeHash = await bcrypt.hash(otp, 10)
    const purpose = purposeFor(jobId)

    await prisma.$transaction(async (tx) => {
      await tx.oTP.updateMany({
        where: { userId: user.id, purpose, isUsed: false },
        data: { isUsed: true },
      })
      await tx.oTP.create({
        data: {
          userId: user.id,
          codeHash,
          purpose,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          metadata: { jobId, action: 'CANCEL_JOB' },
        },
      })
    })

    if (!synthetic) {
      try {
        await sendOtpSms(user.phone, otp, user.countryCode || 'LK')
      } catch (error) {
        console.error('Cancellation OTP delivery failed:', error)
        await prisma.oTP.updateMany({
          where: { userId: user.id, purpose, isUsed: false },
          data: { isUsed: true },
        })
        return NextResponse.json({ error: 'Could not send cancellation code. Please try again.', code: 'OTP_DELIVERY_FAILED' }, { status: 503 })
      }
    }

    return NextResponse.json({ success: true, testMode: synthetic })
  } catch (error) {
    console.error('Cancellation OTP request error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
