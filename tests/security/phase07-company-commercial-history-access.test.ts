import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  user: 'customer',
  suspended: false,
  job: { id: 'job', customerId: 'customer' } as null | { id: string; customerId: string },
  quote: { providerType: 'COMPANY', providerId: 'company' } as null | { providerType: string; providerId: string },
  managedCompanies: [] as string[],
  assignedCompany: null as string | null,
  jobFind: vi.fn(),
  quoteFind: vi.fn(),
  management: vi.fn(),
  assigned: vi.fn(),
  history: vi.fn(),
  finalAmount: vi.fn(),
  escalation: vi.fn(),
  events: vi.fn(),
}))

vi.mock('@/lib/auth/marketplace-auth', () => ({
  authenticateMarketplaceUser: async () => mocks.user
    ? { id: mocks.user, isActive: true, role: 'CUSTOMER' }
    : null,
  assertNotSuspended: () => mocks.suspended
    ? NextResponse.json({ error: 'Suspended' }, { status: 403 })
    : null,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceJob: { findUnique: mocks.jobFind },
    jobQuote: { findFirst: mocks.quoteFind },
    jobLifecycleEvent: { findMany: mocks.events },
  },
}))
vi.mock('@/lib/phase6/company-job-read-access', () => ({
  getReadableCompanyIds: mocks.management,
  getActiveAssignedCompanyId: mocks.assigned,
}))
vi.mock('@/lib/domain/risk-events', () => ({
  getCommercialHistory: mocks.history,
  calculatePriceEscalationSignals: mocks.escalation,
}))
vi.mock('@/lib/domain/change-order', () => ({
  calculateFinalAuthorizedAmount: mocks.finalAmount,
}))

async function get(jobId = 'job') {
  const { GET } = await import('@/app/api/mobile/v2/jobs/[id]/commercial-history/route')
  return GET(
    new NextRequest('http://localhost/api/mobile/v2/jobs/' + jobId + '/commercial-history'),
    { params: Promise.resolve({ id: jobId }) },
  )
}

describe('Phase 07 — company commercial history is private to management and assigned workers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = 'customer'
    mocks.suspended = false
    mocks.job = { id: 'job', customerId: 'customer' }
    mocks.quote = { providerType: 'COMPANY', providerId: 'company' }
    mocks.managedCompanies = []
    mocks.assignedCompany = null
    mocks.jobFind.mockImplementation(async () => mocks.job)
    mocks.quoteFind.mockImplementation(async () => mocks.quote)
    mocks.management.mockImplementation(async () => mocks.managedCompanies)
    mocks.assigned.mockImplementation(async () => mocks.assignedCompany)
    mocks.history.mockResolvedValue({ jobId: 'job', status: 'recorded' })
    mocks.finalAmount.mockResolvedValue({ success: true, finalAmountCents: 1200n })
    mocks.escalation.mockResolvedValue([])
    mocks.events.mockResolvedValue([])
  })

  it('allows the customer to inspect their own accepted job financial history', async () => {
    const r = await get()
    expect(r.status).toBe(200)
    expect(mocks.management).not.toHaveBeenCalled()
    expect(mocks.history).toHaveBeenCalledTimes(1)
    const body = await r.json()
    expect(body.finalAuthorizedAmountCents).toBe('1200')
  })

  it('allows the accepted individual provider to read their own history', async () => {
    mocks.user = 'provider'
    mocks.quote = { providerType: 'INDIVIDUAL', providerId: 'provider' }
    expect((await get()).status).toBe(200)
    expect(mocks.management).not.toHaveBeenCalled()
  })

  it('rejects an unrelated individual provider without loading any financial records', async () => {
    mocks.user = 'unrelated'
    mocks.quote = { providerType: 'INDIVIDUAL', providerId: 'provider' }
    expect((await get()).status).toBe(403)
    expect(mocks.history).not.toHaveBeenCalled()
  })

  it('denies ordinary unassigned company staff even if old RBAC quotes:read is broad', async () => {
    mocks.user = 'worker'
    expect((await get()).status).toBe(403)
    expect(mocks.management).toHaveBeenCalledWith('worker')
    expect(mocks.assigned).toHaveBeenCalledWith('job', 'worker')
    expect(mocks.history).not.toHaveBeenCalled()
  })

  it('allows an active manager or dispatcher for the accepted company', async () => {
    mocks.user = 'manager'
    mocks.managedCompanies = ['other-company', 'company']
    expect((await get()).status).toBe(200)
    expect(mocks.assigned).not.toHaveBeenCalled()
  })

  it('does not allow a manager of a DIFFERENT company to read this job', async () => {
    mocks.user = 'manager'
    mocks.managedCompanies = ['other-company']
    mocks.assignedCompany = null
    expect((await get()).status).toBe(403)
    expect(mocks.history).not.toHaveBeenCalled()
  })

  it('allows the actual job worker only with a valid active team assignment', async () => {
    mocks.user = 'worker'
    mocks.assignedCompany = 'company'
    expect((await get()).status).toBe(200)
    expect(mocks.assigned).toHaveBeenCalledWith('job', 'worker')
  })

  it('does not accept an assignment to a DIFFERENT company', async () => {
    mocks.user = 'worker'
    mocks.assignedCompany = 'another-company'
    expect((await get()).status).toBe(403)
    expect(mocks.history).not.toHaveBeenCalled()
  })

  it('denies suspended accounts before looking up private booking data', async () => {
    mocks.suspended = true
    expect((await get()).status).toBe(403)
    expect(mocks.jobFind).not.toHaveBeenCalled()
    expect(mocks.history).not.toHaveBeenCalled()
  })

  it('rejects missing jobs without exposing data or provider details', async () => {
    mocks.job = null
    expect((await get()).status).toBe(404)
    expect(mocks.quoteFind).not.toHaveBeenCalled()
  })

  it('refuses jobs without accepted provider confirmation to non-customer actors', async () => {
    mocks.user = 'worker'
    mocks.quote = null
    expect((await get()).status).toBe(403)
    expect(mocks.history).not.toHaveBeenCalled()
  })

  it('rejects unknown historical provider types instead of falling through', async () => {
    mocks.user = 'provider'
    mocks.quote = { providerType: 'UNKNOWN', providerId: 'provider' }
    expect((await get()).status).toBe(403)
    expect(mocks.history).not.toHaveBeenCalled()
  })
})
