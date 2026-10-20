import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const state = vi.hoisted(() => ({
  user: 'customer' as string | null,
  job: vi.fn(), crew: vi.fn(), quote: vi.fn(),
  photos: vi.fn(), members: vi.fn(), checks: vi.fn(),
  transaction: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: state.transaction,
  },
}))
vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => state.user ? { id: state.user } : null,
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/shared/observability/secure-console', () => ({
  secureConsole: { error: vi.fn() },
}))

async function load() {
  const { GET } = await import('@/app/api/mobile/v2/jobs/[id]/crew-identity/route')
  const response = await GET(new NextRequest('http://localhost/api/mobile/v2/jobs/booking/crew-identity'),
    { params: Promise.resolve({ id: 'booking' }) })
  return { status: response.status, body: await response.json() }
}

const slots = [
  {
    id: 'slot-1', workerUserId: 'worker-a', status: 'CREW_ACCEPTED',
    crewSlot: 1, crewRole: 'LEAD', acceptedAt: new Date('2026-10-20T00:00:00Z'),
    crewIdentityConfirmedAt: null,
    worker: {
      name: 'Worker A', isActive: true,
      isSuspended: false, isBanned: false, identityStatus: 'VERIFIED',
    },
  },
  {
    id: 'slot-2', workerUserId: 'worker-b', status: 'CREW_RESERVED',
    crewSlot: 2, crewRole: 'MEMBER', acceptedAt: null,
    crewIdentityConfirmedAt: null,
    worker: {
      name: 'Worker B', isActive: true,
      isSuspended: false, isBanned: false, identityStatus: 'VERIFIED',
    },
  },
]

describe('Phase04 customer-only all-member photo preview remains nonbinding', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.user = 'customer'
    state.transaction.mockImplementation(async fn => fn({
      marketplaceJob: { findUnique: state.job },
      companyCrewDispatch: { findUnique: state.crew },
      jobQuote: { findFirst: state.quote },
      providerIdentity: { findMany: state.photos },
      teamMember: { findMany: state.members },
      jobWorkerIdentityCheck: { findMany: state.checks },
    }))
    state.job.mockResolvedValue({
      customerId: 'customer', status: 'QUOTE_ACCEPTED', workersCount: 2,
    })
    state.crew.mockResolvedValue({
      id: 'crew', companyId: 'company', status: 'FORMING', version: 1,
      requiredWorkersCount: 2, assignments: slots,
    })
    state.quote.mockResolvedValue({ id: 'accepted-company-quote' })
    state.photos.mockResolvedValue([
      { id: 'identity-a', currentUserId: 'worker-a', verifiedPhotoUrl: '/approved-a' },
    ])
    state.members.mockResolvedValue([{ userId: 'worker-a' }])
    state.checks.mockResolvedValue([])
  })

  it('denies noncustomer and unauthenticated reads before profile photos', async () => {
    state.user = null
    expect((await load()).status).toBe(401)
    state.user = 'outsider'
    expect((await load()).status).toBe(404)
    expect(state.photos).not.toHaveBeenCalled()
  })

  it('shows only accepted, still-verified photos and never grants work', async () => {
    const { status, body } = await load()
    expect(status).toBe(200)
    expect(body).toMatchObject({
      dispatchEnabled: false, workStartEnabled: false, arrivalPinEnabled: false,
      allConfirmed: false,
      crew: { id: 'crew', status: 'FORMING', version: 1, requiredWorkersCount: 2 },
    })
    expect(body.workers).toHaveLength(2)
    expect(body.workers[0]).toMatchObject({
      status: 'CREW_ACCEPTED', displayName: 'Worker A',
      verifiedPhotoUrl: '/approved-a', photoReady: true, customerConfirmed: false,
    })
    expect(body.workers[1]).toMatchObject({
      status: 'CREW_RESERVED', displayName: null,
      verifiedPhotoUrl: null, photoReady: false,
    })
  })

  it('does not display a photo for suspended workers or withdrawn membership', async () => {
    state.crew.mockResolvedValue({
      id: 'crew', companyId: 'company', status: 'FORMING', version: 1,
      requiredWorkersCount: 2,
      assignments: [{ ...slots[0], worker: { ...slots[0].worker, isSuspended: true } }, slots[1]],
    })
    const result = await load()
    expect(result.body.workers[0].photoReady).toBe(false)
    expect(result.body.workers[0].verifiedPhotoUrl).toBeNull()
  })

  it('does not trust a stale MATCHED legacy identity record as all-crew confirmation', async () => {
    state.checks.mockResolvedValue([{
      assignedWorkerUserId: 'worker-a', providerIdentityId: 'identity-a',
      status: 'MATCHED', confirmedAt: new Date('2026-10-20T01:00:00Z'),
      photoSnapshotUrl: '/approved-a',
    }])
    const result = await load()
    expect(result.body.workers[0].customerConfirmed).toBe(false)
    expect(result.body.allConfirmed).toBe(false)
  })

  it('refuses an unrelated quote or terminal blocked crew', async () => {
    state.quote.mockResolvedValue(null)
    expect((await load()).status).toBe(404)
    state.quote.mockResolvedValue({ id: 'accepted-company-quote' })
    state.crew.mockResolvedValue({
      id: 'crew', companyId: 'company', status: 'BLOCKED', version: 2,
      requiredWorkersCount: 2, assignments: slots,
    })
    const result = await load()
    expect(result.body.workers).toEqual([])
    expect(result.body.workStartEnabled).toBe(false)
  })
})
