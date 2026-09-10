import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dispute = await prisma.dispute.findFirst({
      where: { id, raisedById: user.id },
      include: {
        job: {
          select: { id: true, title: true, description: true, budget: true, status: true },
        },
        raisedBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: dispute.id,
      jobId: dispute.jobId,
      job: dispute.job,
      reason: dispute.reason,
      description: dispute.description,
      resolution: dispute.resolution,
      status: dispute.status,
      raisedBy: dispute.raisedBy,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Dispute get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
