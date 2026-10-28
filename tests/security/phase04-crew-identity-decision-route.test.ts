import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  user: 'customer' as string | null,
  decide: vi.fn(), transaction: vi.fn(),
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => mock.user ? { id: mock.user } : null,
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mock.transaction } }))
vi.mock('@/lib/domain/company-crew-identity', () => ({
  decideCrewWorkerIdentityInsideTransaction: mock.decide,
}))
vi.mock('@/lib/shared/observability/secure-console', () => ({
  secureConsole: { error: vi.fn() },
}))

async function request(body: unknown) {
  const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/crew-identity/route')
  return POST(new NextRequest('http://localhost/api/mobile/v2/jobs/booking/crew-identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: 'booking' }) })
}

describe('Phase04 crew photo decisions bind to customer, never start work', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.user = 'customer'
    mock.transaction.mockImplementation(async fn => fn({ marker: 'tx' }))
    mock.decide.mockResolvedValue({
      status: 'FORMING', version: 1, customerConfirmed: true,
      safetyReviewRequired: false, dispatchEnabled: false,
    })
  })

  it('rejects unauthenticated and caller-spoofed customer IDs', async () => {
    mock.user = null
    expect((await request({ crewDispatchId: 'crew', assignmentId: 'slot',
      expectedVersion: 1, decision: 'MATCH' })).status).toBe(401)
    mock.user = 'customer'
    expect((await request({ crewDispatchId: 'crew', assignmentId: 'slot',
      expectedVersion: 1, decision: 'MATCH', customerUserId: 'victim' })).status).toBe(400)
    expect(mock.transaction).not.toHaveBeenCalled()
  })

  it('records only authenticated customer decisions in SERIALIZABLE transaction', async () => {
    const res = await request({
      crewDispatchId: 'crew', assignmentId: 'slot',
      expectedVersion: 1, decision: 'MATCH',
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      dispatchEnabled: false, workStartEnabled: false, arrivalPinEnabled: false,
    })
    expect(mock.decide).toHaveBeenCalledWith({ marker: 'tx' }, {
      jobId: 'booking', customerUserId: 'customer',
      crewDispatchId: 'crew', assignmentId: 'slot',
      expectedVersion: 1, decision: 'MATCH', reason: undefined,
    })
    expect(mock.transaction).toHaveBeenCalledWith(expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }))
  })

  it('rejects invalid epoch, invalid decisions and overlong safety remarks', async () => {
    for (const value of [
      null,
      { crewDispatchId: 'crew', assignmentId: 'slot', expectedVersion: 0, decision: 'MATCH' },
      { crewDispatchId: 'crew', assignmentId: 'slot', expectedVersion: 1, decision: 'START' },
      { crewDispatchId: 'crew', assignmentId: 'slot', expectedVersion: 1,
        decision: 'MISMATCH', reason: 'x'.repeat(251) },
      { crewDispatchId: 'crew', assignmentId: '', expectedVersion: 1, decision: 'MATCH' },
    ]) expect((await request(value)).status).toBe(400)
    expect(mock.transaction).not.toHaveBeenCalled()
  })
})
