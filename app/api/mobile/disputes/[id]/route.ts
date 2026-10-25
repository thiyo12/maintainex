import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { resolveMarketplaceDisputeParticipant } from '@/lib/domain/marketplace-dispute-participants'

function parseEventMetadata(value: string | null) {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const marketplaceDispute = await prisma.marketplaceDispute.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            customerId: true,
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
      const participant = await resolveMarketplaceDisputeParticipant(prisma, marketplaceDispute.jobId, user.id)
      if (!participant) {
        return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
      }

      const raisedBy = await prisma.user.findUnique({
        where: { id: marketplaceDispute.raisedById },
        select: { id: true, name: true },
      })
      const events = await prisma.jobLifecycleEvent.findMany({
        where: {
          jobId: marketplaceDispute.jobId,
          action: { in: ['FINANCIAL_DISPUTE_RESOLVED', 'FINANCIAL_DISPUTE_REOPENED', 'FINANCIAL_DISPUTE_APPEALED'] },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, action: true, fromState: true, toState: true, metadata: true, createdAt: true },
      })
      const evidence = await prisma.marketplaceDisputeEvidence.findMany({
        where: { disputeId: marketplaceDispute.id, submittedById: user.id },
        select: { id: true, participantType: true, evidenceType: true, description: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
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
        evidence,
        status: marketplaceDispute.status,
        caseHistory: events.flatMap(event => {
          const metadata = parseEventMetadata(event.metadata)
          if (metadata?.disputeId !== marketplaceDispute.id) return []
          return [{
            id: event.id,
            action: event.action,
            fromState: event.fromState,
            toState: event.toState,
            appeal: typeof metadata.appeal === 'string' ? metadata.appeal : null,
            resolution: typeof metadata.resolution === 'string' ? metadata.resolution : null,
            resolutionAction: typeof metadata.resolutionAction === 'string' ? metadata.resolutionAction : null,
            createdAt: event.createdAt.toISOString(),
          }]
        }),
        raisedBy: raisedBy || {
          id: marketplaceDispute.raisedById,
          name: null,
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
    secureConsole.error('Dispute get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
