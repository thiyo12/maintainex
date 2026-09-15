import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { getCommercialHistory, calculatePriceEscalationSignals } from '@/lib/domain/risk-events'
import { calculateFinalAuthorizedAmount } from '@/lib/domain/change-order'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: jobId } = await params

    // Verify user is job customer or assigned provider
    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    if (job.customerId !== user.id) {
      // Check if user is the assigned provider
      const quote = await prisma.jobQuote.findFirst({
        where: { jobId, providerId: user.id },
      })
      if (!quote) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const history = await getCommercialHistory(prisma, jobId)
    if (!history) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const finalAmount = await calculateFinalAuthorizedAmount(prisma, jobId)
    const escalationSignals = await calculatePriceEscalationSignals(prisma, jobId)

    return NextResponse.json({
      commercialHistory: history,
      finalAuthorizedAmountCents: finalAmount.success ? finalAmount.finalAmountCents : null,
      escalationSignals,
    })
  } catch (error) {
    console.error('Get commercial history error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
