import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { randomInt } from 'crypto'

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

    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.jobWorkspace.findUnique({ where: { jobId: id } })
      if (!workspace) throw new Error('Workspace not found')
      if (workspace.progressStatus !== 'ACCEPTED') throw new Error('Job has already started')

      const job = await tx.marketplaceJob.findUnique({ where: { id } })
      if (!job) throw new Error('Job not found')
      if (job.status !== 'IN_PROGRESS') throw new Error('Job is not in progress')

      const quote = await tx.jobQuote.findFirst({
        where: { jobId: id, status: 'ACCEPTED' },
      })
      if (!quote) throw new Error('No accepted quote found')
      if (quote.providerId !== user.id) throw new Error('Only the assigned provider can generate OTP')

      const otp = String(randomInt(1000, 10000))

      await tx.jobOtp.upsert({
        where: { jobId: id },
        create: { jobId: id, otp },
        update: { otp, generatedAt: new Date(), verifiedAt: null },
      })

      return { otp }
    })

    return NextResponse.json({ otp: result.otp })
  } catch (error: any) {
    console.error('Generate OTP error:', error)
    if (error.message === 'Job has already started' || error.message === 'Only the assigned provider can generate OTP') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message === 'Workspace not found' || error.message === 'Job not found' || error.message === 'No accepted quote found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateRequest(_request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const job = await prisma.marketplaceJob.findUnique({ where: { id } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const isParticipant =
      job.customerId === user.id ||
      !!(await prisma.jobQuote.findFirst({ where: { jobId: id, providerId: user.id } }))
    if (!isParticipant) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const otpRecord = await prisma.jobOtp.findUnique({ where: { jobId: id } })
    if (!otpRecord || otpRecord.verifiedAt) {
      return NextResponse.json({ hasOtp: false })
    }

    const quote = await prisma.jobQuote.findFirst({
      where: { jobId: id, status: 'ACCEPTED' },
      select: { providerId: true },
    })
    const isProvider = quote?.providerId === user.id

    return NextResponse.json({ hasOtp: true, otp: isProvider ? otpRecord.otp : null })
  } catch (error) {
    console.error('Get OTP error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
