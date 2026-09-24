import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { hashPassword, verifyPassword } from '@/lib/security/password'
import { sendOtpSms } from '@/lib/sms'
import { checkOtpSendLimit } from '@/lib/rate-limit-db'
import { isInteractiveTestPhone, isTestOtpAllowed } from '@/lib/test-cert'
import { resolvePreStartCancelActor, cancelJobBeforeStart } from '@/lib/domain/job-cancellation'

function clientIp(request: NextRequest): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params
    const authUser = await authenticateRequest(request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(authUser)
    if (blocked) return blocked

    const body = await request.json()
    const action = typeof body.action === 'string' ? body.action : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, phone: true, countryCode: true, email: true, name: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await resolvePreStartCancelActor(jobId, user.id)

    if (action === 'REQUEST_CODE') {
      if (!user.phone) {
        return NextResponse.json({ error: 'A verified mobile number is required to cancel a job.' }, { status: 400 })
      }

      const testMode = isInteractiveTestPhone(user.phone)
      const ip = clientIp(request)
      if (!testMode) {
        const limit = await checkOtpSendLimit(user.phone, ip)
        if (!limit.allowed) {
          return NextResponse.json({ error: limit.reason, retryAfter: limit.retryAfter }, { status: 429 })
        }
      }

      const purpose = `JOB_CANCEL:${jobId}`
      await prisma.oTP.updateMany({
        where: { userId: user.id, purpose, isUsed: false },
        data: { isUsed: true },
      })

      const code = testMode ? '000000' : String(crypto.randomInt(100000, 1000000))
      await prisma.oTP.create({
        data: {
          userId: user.id,
          codeHash: await hashPassword(code),
          purpose,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          metadata: { ip, jobId, flow: 'JOB_CANCEL', reason },
        },
      })

      await sendOtpSms(user.phone, code, user.countryCode)

      return NextResponse.json({
        success: true,
        channel: testMode ? 'test' : 'sms',
        expiresIn: 300,
        ...(testMode ? { testMode: true } : {}),
      })
    }

    if (action === 'CONFIRM') {
      const code = typeof body.code === 'string' ? body.code.trim() : ''
      if (!/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: 'Enter the 6-digit cancellation code.' }, { status: 400 })
      }

      const purpose = `JOB_CANCEL:${jobId}`
      const otp = await prisma.oTP.findFirst({
        where: {
          userId: user.id,
          purpose,
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (!otp) {
        return NextResponse.json({ error: 'Cancellation code expired or not found.' }, { status: 400 })
      }
      if (otp.attempts >= 5) {
        await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })
        return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 })
      }

      const valid = isTestOtpAllowed(user, code) || await verifyPassword(code, otp.codeHash)
      if (!valid) {
        const attempts = otp.attempts + 1
        await prisma.oTP.update({
          where: { id: otp.id },
          data: { attempts, ...(attempts >= 5 ? { isUsed: true } : {}) },
        })
        return NextResponse.json({ error: 'Incorrect cancellation code.' }, { status: 400 })
      }

      const activeEscrow = await prisma.jobEscrow.findFirst({
        where: { jobId, status: { in: ['PROTECTED', 'ON_HOLD'] } },
        select: { id: true },
      })

      await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })
      const result = await cancelJobBeforeStart(jobId, user.id)

      return NextResponse.json({
        success: true,
        status: result.state,
        reopened: result.reopened,
        refunded: Boolean(activeEscrow),
      })
    }

    return NextResponse.json({ error: 'action must be REQUEST_CODE or CONFIRM' }, { status: 400 })
  } catch (error: any) {
    const message = error?.message || 'Unable to cancel job'
    if (/SMS provider is not configured|Unable to send SMS/i.test(message)) {
      return NextResponse.json({ error: 'OTP_DELIVERY_FAILED' }, { status: 503 })
    }
    const status = /not allowed|already started|no longer|not found|dispute|cannot/i.test(message) ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
