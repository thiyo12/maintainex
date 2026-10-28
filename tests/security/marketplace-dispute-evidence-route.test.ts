import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), participant: vi.fn(), dispute: vi.fn(), findEvidence: vi.fn(), createEvidence: vi.fn(),
  createEvent: vi.fn(), transaction: vi.fn(),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({ authenticateRequest: mocks.auth, assertNotSuspended: () => null }))
vi.mock('@/lib/domain/marketplace-dispute-participants', () => ({ resolveMarketplaceDisputeParticipant: mocks.participant }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  marketplaceDispute: { findUnique: mocks.dispute },
  marketplaceDisputeEvidence: { findMany: mocks.findEvidence, create: mocks.createEvidence, findUnique: mocks.findEvidence },
  marketplaceDisputeEvidenceEvent: { create: mocks.createEvent },
  $transaction: mocks.transaction,
} }))

import { GET, POST } from '@/app/api/mobile/disputes/[id]/evidence/route'

const params = Promise.resolve({ id: 'case-1' })
function post(body: unknown, key = 'evidence-key-0001') {
  return POST(new NextRequest('https://maintainex.test/api/mobile/disputes/case-1/evidence', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body),
  }), { params })
}

describe('participant dispute evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'customer-1' })
    mocks.dispute.mockResolvedValue({ id: 'case-1', jobId: 'job-1' })
    mocks.participant.mockResolvedValue('CUSTOMER')
    mocks.transaction.mockImplementation(async fn => fn({
      marketplaceDisputeEvidence: { create: mocks.createEvidence },
      marketplaceDisputeEvidenceEvent: { create: mocks.createEvent },
    }))
    mocks.createEvidence.mockResolvedValue({ id: 'ev-1', participantType: 'CUSTOMER', evidenceType: 'NOTE', description: 'Synthetic evidence', createdAt: new Date() })
  })

  it('requires current participant authority and never returns case evidence to outsiders', async () => {
    mocks.participant.mockResolvedValue(null)
    const response = await GET(new NextRequest('https://maintainex.test/api/mobile/disputes/case-1/evidence'), { params })
    expect(response.status).toBe(404)
    expect(mocks.findEvidence).not.toHaveBeenCalled()
  })

  it('requires idempotency and appends hashed audit history atomically', async () => {
    expect((await post({ description: 'facts' }, 'bad')).status).toBe(400)
    const response = await post({ description: 'Synthetic evidence statement.' })
    expect(response.status).toBe(201)
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'PARTICIPANT_EVIDENCE_SUBMITTED' }) }))
    expect(mocks.transaction).toHaveBeenCalledOnce()
  })

  it('rejects oversized notes and nonparticipants', async () => {
    expect((await post({ description: 'x'.repeat(4001) })).status).toBe(400)
    mocks.participant.mockResolvedValue(null)
    expect((await post({ description: 'not authorized' })).status).toBe(404)
    expect(mocks.createEvidence).not.toHaveBeenCalled()
  })
})
