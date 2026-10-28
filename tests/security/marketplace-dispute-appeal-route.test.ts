import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  assertNotSuspended: vi.fn(),
  resolveParticipant: vi.fn(),
  appealInTransaction: vi.fn(),
  disputeFindUnique: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: mocks.authenticateRequest,
  assertNotSuspended: mocks.assertNotSuspended,
}))
vi.mock('@/lib/domain/marketplace-dispute-participants', () => ({
  resolveMarketplaceDisputeParticipant: mocks.resolveParticipant,
}))
vi.mock('@/lib/domain/marketplace-dispute-appeal', () => ({
  appealMarketplaceDisputeInTransaction: mocks.appealInTransaction,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceDispute: { findUnique: mocks.disputeFindUnique },
    $transaction: mocks.transaction,
  },
}))

import { POST } from '@/app/api/mobile/disputes/[id]/appeal/route'

function request(body: unknown) {
  return new NextRequest('https://maintainex.test/api/mobile/disputes/case-1/appeal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('mobile financial-dispute appeal route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticateRequest.mockResolvedValue({ id: 'customer-1' })
    mocks.assertNotSuspended.mockReturnValue(null)
    mocks.disputeFindUnique.mockResolvedValue({ id: 'case-1', jobId: 'job-1', status: 'RESOLVED', job: { customerId: 'customer-1' } })
    mocks.resolveParticipant.mockResolvedValue('CUSTOMER')
    mocks.appealInTransaction.mockResolvedValue({ ok: true, status: 'OPEN', replayed: false })
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback({ transaction: true }))
  })

  it('requires an authenticated, active session and a valid idempotency key', async () => {
    mocks.authenticateRequest.mockResolvedValueOnce(null)
    const unauthorized = await POST(request({ appeal: 'Please review this decision carefully.', idempotencyKey: 'appeal-request-0001' }), { params: Promise.resolve({ id: 'case-1' }) })
    expect(unauthorized.status).toBe(401)

    const invalid = await POST(request({ appeal: 'Please review this decision carefully.', idempotencyKey: 'bad' }), { params: Promise.resolve({ id: 'case-1' }) })
    expect(invalid.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('hides cases from nonparticipants and atomically records authorized appeals', async () => {
    mocks.resolveParticipant.mockResolvedValueOnce(null)
    const hidden = await POST(request({ appeal: 'Please review this decision carefully.', idempotencyKey: 'appeal-request-0001' }), { params: Promise.resolve({ id: 'case-1' }) })
    expect(hidden.status).toBe(404)
    expect(mocks.transaction).not.toHaveBeenCalled()

    const accepted = await POST(request({ appeal: 'Please review this decision carefully.', idempotencyKey: 'appeal-request-0002' }), { params: Promise.resolve({ id: 'case-1' }) })
    expect(accepted.status).toBe(200)
    expect(mocks.appealInTransaction).toHaveBeenCalledWith(
      { transaction: true },
      expect.objectContaining({ disputeId: 'case-1', actorId: 'customer-1', idempotencyKey: 'appeal-request-0002' }),
    )
    await expect(accepted.json()).resolves.toMatchObject({ status: 'OPEN', financialEffect: 'NONE' })
  })
})
