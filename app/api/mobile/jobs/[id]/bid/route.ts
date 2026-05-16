import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasker = await prisma.taskerProfile.findUnique({ where: { userId: user.id } })
    if (!tasker) {
      return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
    }

    const job = await prisma.jobPosting.findUnique({ where: { id: params.id } })
    if (!job || job.status !== 'OPEN') {
      return NextResponse.json({ error: 'Job not available for bidding' }, { status: 400 })
    }

    const { amount, message } = await request.json()
    if (!amount) {
      return NextResponse.json({ error: 'Bid amount required' }, { status: 400 })
    }

    const existing = await prisma.bid.findUnique({
      where: { jobId_taskerId: { jobId: params.id, taskerId: tasker.id } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Already bid on this job' }, { status: 409 })
    }

    const bid = await prisma.bid.create({
      data: { jobId: params.id, taskerId: tasker.id, amount: parseFloat(amount), message },
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
