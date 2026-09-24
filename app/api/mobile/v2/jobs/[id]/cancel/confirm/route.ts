import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { verifyPassword } from '@/lib/security/password'
import { isTestOtpAllowed } from '@/lib/test-cert'
import { cancelJobBeforeStart } from '@/lib/domain/job-cancellation'

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
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit cancellation code.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, phone: true, email: true, name: true },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

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

    await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } })
    const result = await cancelJobBeforeStart(jobId, user.id)

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    const message = error?.message || 'Unable to cancel job'
    const status = /not allowed|already started|no longer|not found|dispute/i.test(message) ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
