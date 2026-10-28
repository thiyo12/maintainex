import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { prisma } from '@/lib/prisma'
import { resolveMarketplaceDisputeParticipant } from '@/lib/domain/marketplace-dispute-participants'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  const { id } = await params
  const dispute = await prisma.marketplaceDispute.findUnique({ where: { id }, select: { id: true, jobId: true } })
  if (!dispute || !await resolveMarketplaceDisputeParticipant(prisma, dispute.jobId, user.id)) {
    return NextResponse.json({ error: 'Dispute not found' }, { status: 404, headers: noStore })
  }
  const evidence = await prisma.marketplaceDisputeEvidence.findMany({
    where: { disputeId: dispute.id, submittedById: user.id },
    select: { id: true, participantType: true, evidenceType: true, description: true, createdAt: true },
    orderBy: { createdAt: 'asc' }, take: 100,
  })
  return NextResponse.json({ evidence }, { headers: noStore })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore })
  const blocked = assertNotSuspended(user)
  if (blocked) return blocked
  const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() || ''
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return NextResponse.json({ error: 'A valid Idempotency-Key is required' }, { status: 400, headers: noStore })
  }
  const body = await request.json().catch(() => null)
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  if (!description || description.length > 4000) {
    return NextResponse.json({ error: 'Evidence note must be between 1 and 4000 characters' }, { status: 400, headers: noStore })
  }
  const { id } = await params
  const dispute = await prisma.marketplaceDispute.findUnique({ where: { id }, select: { id: true, jobId: true } })
  const participantType = dispute && await resolveMarketplaceDisputeParticipant(prisma, dispute.jobId, user.id)
  if (!dispute || !participantType) return NextResponse.json({ error: 'Dispute not found' }, { status: 404, headers: noStore })
  const contentSha256 = createHash('sha256').update(description, 'utf8').digest('hex')
  try {
    const evidence = await prisma.$transaction(async tx => {
      const row = await tx.marketplaceDisputeEvidence.create({
        data: { disputeId: dispute.id, submittedById: user.id, participantType, description, contentSha256, idempotencyKey },
        select: { id: true, participantType: true, evidenceType: true, description: true, createdAt: true },
      })
      await tx.marketplaceDisputeEvidenceEvent.create({
        data: { evidenceId: row.id, eventType: 'PARTICIPANT_EVIDENCE_SUBMITTED', actorId: user.id, metadata: JSON.stringify({ sha256: contentSha256 }) },
      })
      return row
    })
    return NextResponse.json({ evidence, reused: false }, { status: 201, headers: noStore })
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'P2002') {
      const existing = await prisma.marketplaceDisputeEvidence.findUnique({
        where: { disputeId_submittedById_idempotencyKey: { disputeId: dispute.id, submittedById: user.id, idempotencyKey } },
        select: { id: true, participantType: true, evidenceType: true, description: true, contentSha256: true, createdAt: true },
      })
      if (existing?.contentSha256 === contentSha256) {
        const { contentSha256: _hash, ...safe } = existing
        return NextResponse.json({ evidence: safe, reused: true }, { headers: noStore })
      }
      return NextResponse.json({ error: 'Idempotency key was already used for different evidence' }, { status: 409, headers: noStore })
    }
    return NextResponse.json({ error: 'Unable to submit evidence' }, { status: 500, headers: noStore })
  }
}
