import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Job is not in progress' }, { status: 400 })
    }

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId: job.id } })
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    if (workspace.progressStatus !== 'ACCEPTED') {
      return NextResponse.json({ error: 'Job has already started' }, { status: 400 })
    }

    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: job.id, status: 'ACCEPTED' },
    })
    if (!quote) return NextResponse.json({ error: 'No accepted quote found' }, { status: 400 })
    if (quote.providerId !== user.id) {
      return NextResponse.json({ error: 'Only the assigned provider can generate OTP' }, { status: 403 })
    }

    const otp = String(Math.floor(1000 + Math.random() * 9000))

    await prisma.jobOtp.upsert({
      where: { jobId: job.id },
      create: { jobId: job.id, otp },
      update: { otp, generatedAt: new Date(), verifiedAt: null },
    })

    return NextResponse.json({ otp })
  } catch (error) {
    console.error('Generate OTP error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id: params.id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isParticipant =
      job.customerId === user.id ||
      !!(await prisma.jobQuote.findFirst({ where: { jobId: params.id, providerId: user.id } }))
    if (!isParticipant) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const otpRecord = await prisma.jobOtp.findUnique({ where: { jobId: params.id } })
    if (!otpRecord || otpRecord.verifiedAt) {
      return NextResponse.json({ hasOtp: false })
    }

    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: params.id, status: 'ACCEPTED' },
      select: { providerId: true },
    })
    const isProvider = quote?.providerId === user.id

    return NextResponse.json({ hasOtp: true, otp: isProvider ? otpRecord.otp : null })
  } catch (error) {
    console.error('Get OTP error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
