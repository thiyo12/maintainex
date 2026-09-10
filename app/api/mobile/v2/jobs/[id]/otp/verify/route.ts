import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { verifyOtpAndStartJob } from '@/lib/domain/job-lifecycle'
import { notifyJobStarted } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { otp } = body
    if (!otp || typeof otp !== 'string') {
      return NextResponse.json({ error: 'OTP is required' }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    await verifyOtpAndStartJob(
      { jobId: id, actorId: user.id, actorType: 'CUSTOMER' },
      id,
      otp
    )

    notifyJobStarted(job.id, job.customerId, job.title)

    return NextResponse.json({ success: true, message: 'Job started' })
  } catch (error: any) {
    console.error('Verify OTP error:', error)
    const message = error?.message || 'Server error'
    if (message.includes('OTP') || message.includes('otp') || message.includes('already started') || message.includes('No OTP')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('Invalid OTP')) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
