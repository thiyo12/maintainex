import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { checkIndividualProviderEligibility } from '@/lib/phase6/provider-eligibility'

function legacyMarketplaceWriteDisabled() {
  return process.env.ALLOW_LEGACY_MARKETPLACE_WRITES !== 'true'
}

function legacyMarketplaceWriteResponse() {
  return NextResponse.json(
    {
      error: 'Legacy marketplace writes are disabled. Use the V2 marketplace flow.',
      code: 'LEGACY_MARKETPLACE_WRITE_DISABLED',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (legacyMarketplaceWriteDisabled()) return legacyMarketplaceWriteResponse()

  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    if (user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Only taskers can bid on legacy jobs' }, { status: 403 })
    }

    const tasker = await prisma.taskerProfile.findUnique({ where: { userId: user.id } })
    if (!tasker) {
      return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
    }

    const eligibility = await checkIndividualProviderEligibility(user.id)
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: 'Tasker is not eligible to bid', reasons: eligibility.reasons },
        { status: 403 }
      )
    }

    const job = await prisma.jobPosting.findUnique({ where: { id } })
    if (!job || job.status !== 'OPEN') {
      return NextResponse.json({ error: 'Job not available for bidding' }, { status: 400 })
    }

    const { amount, message } = await request.json()
    if (!amount) {
      return NextResponse.json({ error: 'Bid amount required' }, { status: 400 })
    }

    const existing = await prisma.bid.findUnique({
      where: { jobId_taskerId: { jobId: id, taskerId: tasker.id } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Already bid on this job' }, { status: 409 })
    }

    const bid = await prisma.bid.create({
      data: { jobId: id, taskerId: tasker.id, amount: parseFloat(amount), message },
    })

    return NextResponse.json({
      id: bid.id,
      jobId: bid.jobId,
      taskerId: bid.taskerId,
      amount: bid.amount,
      message: bid.message,
      status: bid.status,
      createdAt: bid.createdAt.toISOString(),
    })
  } catch (error) {
    console.error('Bid error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
