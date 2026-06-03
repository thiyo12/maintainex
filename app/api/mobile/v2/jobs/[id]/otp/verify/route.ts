import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { notifyJobStarted } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { otp } = body
    if (!otp || typeof otp !== 'string') {
      return NextResponse.json({ error: 'OTP is required' }, { status: 400 })
    }

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.customerId !== user.id) {
      return NextResponse.json({ error: 'Only the customer can verify OTP' }, { status: 403 })
    }

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    if (workspace.progressStatus !== 'ACCEPTED') {
      return NextResponse.json({ error: 'OTP already verified or job already started' }, { status: 400 })
    }

    const otpRecord = await prisma.jobOtp.findUnique({ where: { jobId: job.id } })
    if (!otpRecord) {
      return NextResponse.json({ error: 'No OTP generated yet. Ask the provider to generate one.' }, { status: 400 })
    }
    if (otpRecord.verifiedAt) {
      return NextResponse.json({ error: 'OTP already used' }, { status: 400 })
    }
    if (otpRecord.otp !== otp) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 403 })
    }

    await prisma.$transaction([
      prisma.jobOtp.update({
        where: { id: otpRecord.id },
        data: { verifiedAt: new Date() },
      }),
      prisma.jobWorkspace.update({
        where: { jobId: job.id },
        data: { progressStatus: 'IN_PROGRESS' },
      }),
    ])

    notifyJobStarted(job.id, job.customerId, job.title)

    return NextResponse.json({ success: true, message: 'Job started' })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
