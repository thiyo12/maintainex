import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { hashPassword } from '@/lib/security/password'
import { sendOtpSms } from '@/lib/sms'
import { checkOtpSendLimit } from '@/lib/rate-limit-db'
import { isInteractiveTestPhone } from '@/lib/test-cert'
import { resolvePreStartCancelActor } from '@/lib/domain/job-cancellation'

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

    await resolvePreStartCancelActor(jobId, authUser.id)

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, phone: true, countryCode: true, email: true, name: true },
    })
    if (!user?.phone) {
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
    const codeHash = await hashPassword(code)
    await prisma.oTP.create({
      data: {
        userId: user.id,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        metadata: { ip, jobId, flow: 'JOB_CANCEL' },
      },
    })

    if (!testMode) {
      await sendOtpSms(user.phone, code, user.countryCode)
    }

    return NextResponse.json({
      success: true,
      expiresIn: 300,
      ...(testMode ? { channel: 'test', testMode: true } : {}),
    })
  } catch (error: any) {
    const message = error?.message || 'Unable to request cancellation code'
    const status = /not allowed|already started|no longer|not found/i.test(message) ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
