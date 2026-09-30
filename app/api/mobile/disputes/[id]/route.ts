import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const marketplaceDispute = await prisma.marketplaceDispute.findFirst({
      where: { id, raisedById: user.id },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            countryCode: true,
            budgetAmount: true,
            finalAuthorizedAmountCents: true,
          },
        },
      },
    })

    if (marketplaceDispute) {
      const raisedBy = await prisma.user.findUnique({
        where: { id: marketplaceDispute.raisedById },
        select: { id: true, name: true, email: true },
      })
      const budgetMinor =
        marketplaceDispute.job.finalAuthorizedAmountCents ??
        marketplaceDispute.job.budgetAmount ??
        0n

      return NextResponse.json({
        id: marketplaceDispute.id,
        source: 'MARKETPLACE',
        jobId: marketplaceDispute.jobId,
        escrowId: marketplaceDispute.escrowId,
        job: {
          id: marketplaceDispute.job.id,
          title: marketplaceDispute.job.title,
          description: marketplaceDispute.job.description,
          budgetMinor: budgetMinor.toString(),
          countryCode: marketplaceDispute.job.countryCode,
          status: marketplaceDispute.job.status,
        },
        reason: marketplaceDispute.reason,
        description: marketplaceDispute.description,
        resolution: marketplaceDispute.resolution,
        resolutionAction: marketplaceDispute.resolutionAction,
        status: marketplaceDispute.status,
        raisedBy: raisedBy || {
          id: marketplaceDispute.raisedById,
          name: null,
          email: null,
        },
        createdAt: marketplaceDispute.createdAt.toISOString(),
        updatedAt: marketplaceDispute.updatedAt.toISOString(),
      })
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
