import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { resolveMarketplaceDisputeParticipant } from '@/lib/domain/marketplace-dispute-participants'
import { secureConsole } from '@/lib/shared/observability/secure-console'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await authenticateRequest(request)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id: jobId } = await params
    if (!jobId || jobId.length > 128) return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })

    const participant = await resolveMarketplaceDisputeParticipant(prisma, jobId, actor.id)
    if (!participant) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    const dispute = await prisma.marketplaceDispute.findUnique({
      where: { jobId },
      select: { id: true, status: true },
    })
    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })

    return NextResponse.json({ ...dispute, jobId }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    secureConsole.error('Dispute lookup error:', error)
    return NextResponse.json({ error: 'Unable to load dispute' }, { status: 500 })
  }
}
