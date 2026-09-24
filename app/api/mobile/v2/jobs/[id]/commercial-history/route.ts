import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { getCommercialHistory, calculatePriceEscalationSignals } from '@/lib/domain/risk-events'
import { calculateFinalAuthorizedAmount } from '@/lib/domain/change-order'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

function toJsonSafe<T>(value: T): any {
  return JSON.parse(JSON.stringify(value, (_key, item) =>
    typeof item === 'bigint' ? item.toString() : item
  ))
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return { raw: value }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: jobId } = await params

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    if (job.customerId !== user.id) {
      const acceptedQuote = await prisma.jobQuote.findFirst({
        where: { jobId, status: 'ACCEPTED' },
        select: { providerId: true, providerType: true },
      })
      if (!acceptedQuote) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (acceptedQuote.providerType === 'INDIVIDUAL') {
        if (acceptedQuote.providerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } else {
        const { error } = await resolveCompanyContext(user.id, acceptedQuote.providerId, 'quotes:read')
        if (error) return error
      }
    }

    const history = await getCommercialHistory(prisma, jobId)
    if (!history) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const [finalAmount, escalationSignals, lifecycleEvents] = await Promise.all([
      calculateFinalAuthorizedAmount(prisma, jobId),
      calculatePriceEscalationSignals(prisma, jobId),
      prisma.jobLifecycleEvent.findMany({
        where: { jobId },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    return NextResponse.json({
      commercialHistory: toJsonSafe(history),
      finalAuthorizedAmountCents:
        finalAmount.success && finalAmount.finalAmountCents != null
          ? finalAmount.finalAmountCents.toString()
          : null,
      escalationSignals: toJsonSafe(escalationSignals),
      lifecycleEvents: lifecycleEvents.map(event => ({
        id: event.id,
        actorId: event.actorId,
        actorType: event.actorType,
        action: event.action,
        fromState: event.fromState,
        toState: event.toState,
        metadata: parseMetadata(event.metadata),
        createdAt: event.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Get commercial history error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
