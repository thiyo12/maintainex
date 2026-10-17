import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  userId: 'worker',
  memberActive: false,
  quote: { providerId: 'company', providerType: 'COMPANY' } as null | { providerId: string; providerType: string },
  order: { id: 'order', jobId: 'job', revisionNumber: 2, job: { customerId: 'customer', title: 'Job' } },
  orderFind: vi.fn(),
  acceptedFind: vi.fn(),
  companyFind: vi.fn(),
  membership: vi.fn(),
  submit: vi.fn(),
  cancel: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  notifySubmit: vi.fn(),
  notifyApproved: vi.fn(),
  notifyRejected: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => ({ id: mocks.userId, name: 'Test provider' }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  jobChangeOrder: { findUnique: mocks.orderFind },
  jobQuote: { findFirst: mocks.acceptedFind },
  companyProfile: { findUnique: mocks.companyFind },
} }))
vi.mock('@/lib/phase6/company-context', () => ({
  resolveCompanyContext: mocks.membership,
}))
vi.mock('@/lib/domain/change-order', () => ({
  transitionChangeOrder: mocks.submit,
  cancelChangeOrder: mocks.cancel,
  approveChangeOrder: mocks.approve,
  rejectChangeOrder: mocks.reject,
}))
vi.mock('@/lib/notifications', () => ({
  notifyChangeOrderSubmitted: mocks.notifySubmit,
  notifyChangeOrderApproved: mocks.notifyApproved,
  notifyChangeOrderRejected: mocks.notifyRejected,
}))

async function patch(action: string) {
  const { PATCH } = await import('@/app/api/mobile/v2/jobs/[id]/change-orders/[changeOrderId]/route')
  return PATCH(new NextRequest('http://localhost/api/mobile/v2/jobs/job/change-orders/order', {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  }), { params: Promise.resolve({ id: 'job', changeOrderId: 'order' }) })
}

describe('Phase 07 — company order writes revoke with staff membership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.userId = 'worker'
    mocks.memberActive = false
    mocks.quote = { providerId: 'company', providerType: 'COMPANY' }
    mocks.orderFind.mockResolvedValue(mocks.order)
    mocks.acceptedFind.mockImplementation(async () => mocks.quote)
    mocks.companyFind.mockResolvedValue({ userId: 'company-owner' })
    mocks.membership.mockImplementation(async () => mocks.memberActive
      ? { context: { companyId: 'company', role: 'MANAGER' } }
      : { error: NextResponse.json({ error: 'Membership revoked' }, { status: 403 }) })
    mocks.submit.mockResolvedValue({ success: true })
    mocks.cancel.mockResolvedValue({ success: true })
    mocks.approve.mockResolvedValue({ success: true, finalAuthorizedAmountCents: 1500n })
    mocks.reject.mockResolvedValue({ success: true })
  })

  it('denies former worker submitting an old company draft', async () => {
    expect((await patch('submit')).status).toBe(403)
    expect(mocks.membership).toHaveBeenCalledWith('worker', 'company', 'quotes:submit')
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  it('denies former worker cancelling an old company change order', async () => {
    expect((await patch('cancel')).status).toBe(403)
    expect(mocks.cancel).not.toHaveBeenCalled()
  })

  it('allows current authorized company creator to submit (domain still checks creator)', async () => {
    mocks.memberActive = true
    expect((await patch('submit')).status).toBe(200)
    expect(mocks.submit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        changeOrderId: 'order', userId: 'worker', toStatus: 'SUBMITTED',
      }),
    )
  })

  it('allows current authorized company creator to cancel (domain checks creator)', async () => {
    mocks.memberActive = true
    expect((await patch('cancel')).status).toBe(200)
    expect(mocks.cancel).toHaveBeenCalledWith(expect.anything(), 'order', 'worker')
  })

  it('keeps customer cancellation working even if provider membership is unavailable', async () => {
    mocks.userId = 'customer'
    expect((await patch('cancel')).status).toBe(200)
    expect(mocks.membership).not.toHaveBeenCalled()
    expect(mocks.cancel).toHaveBeenCalled()
  })

  it('retains customer approval without provider-company membership checks', async () => {
    mocks.userId = 'customer'
    expect((await patch('approve')).status).toBe(200)
    expect(mocks.membership).not.toHaveBeenCalled()
  })

  it('refuses a different individual trying to submit someone else’s order', async () => {
    mocks.userId = 'stranger'
    mocks.quote = { providerId: 'provider', providerType: 'INDIVIDUAL' }
    expect((await patch('submit')).status).toBe(403)
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  it('allows current individual provider to submit without company lookup', async () => {
    mocks.userId = 'provider'
    mocks.quote = { providerId: 'provider', providerType: 'INDIVIDUAL' }
    expect((await patch('submit')).status).toBe(200)
    expect(mocks.membership).not.toHaveBeenCalled()
  })

  it('rejects orphaned orders lacking an accepted provider for non-customer writes', async () => {
    mocks.quote = null
    expect((await patch('submit')).status).toBe(403)
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  it('keeps customer rejection independent from company membership', async () => {
    mocks.userId = 'customer'
    expect((await patch('reject')).status).toBe(200)
    expect(mocks.membership).not.toHaveBeenCalled()
  })
})
