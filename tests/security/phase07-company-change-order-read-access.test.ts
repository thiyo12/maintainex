import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  userId: 'customer',
  suspended: false,
  job: { customerId: 'customer' } as null | { customerId: string },
  order: { id: 'order', jobId: 'job', lineItems: [] } as null | { id: string; jobId: string; lineItems: unknown[] },
  accepted: { providerId: 'company', providerType: 'COMPANY' } as null | { providerId: string; providerType: string },
  companies: [] as string[],
  assigned: null as string | null,
  jobFind: vi.fn(),
  orderFind: vi.fn(),
  acceptedFind: vi.fn(),
  management: vi.fn(),
  assignment: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => mocks.userId
    ? { id: mocks.userId, role: 'CUSTOMER' }
    : null,
  assertNotSuspended: () => mocks.suspended
    ? NextResponse.json({ error: 'Suspended' }, { status: 403 }) : null,
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  marketplaceJob: { findUnique: mocks.jobFind },
  jobChangeOrder: { findUnique: mocks.orderFind },
  jobQuote: { findFirst: mocks.acceptedFind },
} }))
vi.mock('@/lib/phase6/company-job-read-access', () => ({
  getReadableCompanyIds: mocks.management,
  getActiveAssignedCompanyId: mocks.assignment,
}))

async function get(jobId = 'job', orderId = 'order') {
  const { GET } = await import('@/app/api/mobile/v2/jobs/[id]/change-orders/[changeOrderId]/route')
  return GET(
    new NextRequest('http://localhost/api/mobile/v2/jobs/' + jobId + '/change-orders/' + orderId),
    { params: Promise.resolve({ id: jobId, changeOrderId: orderId }) },
  )
}

describe('Phase 07 — private change-order finance details honor current team assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.userId = 'customer'
    mocks.suspended = false
    mocks.job = { customerId: 'customer' }
    mocks.order = { id: 'order', jobId: 'job', lineItems: [] }
    mocks.accepted = { providerId: 'company', providerType: 'COMPANY' }
    mocks.companies = []
    mocks.assigned = null
    mocks.jobFind.mockImplementation(async () => mocks.job)
    mocks.orderFind.mockImplementation(async () => mocks.order)
    mocks.acceptedFind.mockImplementation(async () => mocks.accepted)
    mocks.management.mockImplementation(async () => mocks.companies)
    mocks.assignment.mockImplementation(async () => mocks.assigned)
  })

  it('customer reads their own change order', async () => {
    const r = await get()
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ changeOrder: { id: 'order' } })
  })

  it('individual accepted provider reads their own change order', async () => {
    mocks.userId = 'provider'
    mocks.accepted = { providerId: 'provider', providerType: 'INDIVIDUAL' }
    expect((await get()).status).toBe(200)
  })

  it('unrelated individual cannot view order amounts', async () => {
    mocks.userId = 'stranger'
    mocks.accepted = { providerId: 'provider', providerType: 'INDIVIDUAL' }
    expect((await get()).status).toBe(403)
  })

  it('unassigned employee is blocked despite old company quotes:read permission', async () => {
    mocks.userId = 'worker'
    expect((await get()).status).toBe(403)
    expect(mocks.management).toHaveBeenCalledWith('worker')
    expect(mocks.assignment).toHaveBeenCalledWith('job', 'worker')
  })

  it('accepted assigned worker in the right company can see the order', async () => {
    mocks.userId = 'worker'
    mocks.assigned = 'company'
    expect((await get()).status).toBe(200)
  })

  it('old assignment at a different company cannot authorize finance details', async () => {
    mocks.userId = 'worker'
    mocks.assigned = 'other'
    expect((await get()).status).toBe(403)
  })

  it('active company management can read without worker assignment', async () => {
    mocks.userId = 'manager'
    mocks.companies = ['company']
    expect((await get()).status).toBe(200)
    expect(mocks.assignment).not.toHaveBeenCalled()
  })

  it('manager of a different company is denied', async () => {
    mocks.userId = 'manager'
    mocks.companies = ['other']
    expect((await get()).status).toBe(403)
  })

  it('returns 404 on mismatched job and change order, before provider lookups', async () => {
    mocks.order = { id: 'order', jobId: 'other-job', lineItems: [] }
    expect((await get()).status).toBe(404)
    expect(mocks.acceptedFind).not.toHaveBeenCalled()
  })

  it('refuses suspended users before querying private job metadata', async () => {
    mocks.suspended = true
    expect((await get()).status).toBe(403)
    expect(mocks.jobFind).not.toHaveBeenCalled()
  })

  it('blocks unknown provider types from reading finance records', async () => {
    mocks.userId = 'stranger'
    mocks.accepted = { providerId: 'stranger', providerType: 'UNKNOWN' }
    expect((await get()).status).toBe(403)
  })

  it('does not accept a removed or unassigned user without a current valid assignment', async () => {
    mocks.userId = 'worker'
    mocks.assigned = null
    expect((await get()).status).toBe(403)
  })
})
