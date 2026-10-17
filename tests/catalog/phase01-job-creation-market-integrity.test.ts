import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  account: 'CA', market: 'CA' as 'CA' | 'LK',
  category: { id: 'cat', name: 'Plumbing', slug: 'plumbing', isActive: true, countries: '["CA"]' },
  service: { id: 'service', jobCategoryId: 'cat', templateJobId: null as string | null, isActive: true, countryCode: 'CA', currency: 'CAD' },
  job: { id: 'service-job', categoryId: 'cat', isActive: true, countries: '["CA"]', currency: 'CAD' },
  categoryFind: vi.fn(), serviceFind: vi.fn(), templateFind: vi.fn(),
  jobCreate: vi.fn(), price: vi.fn(), blast: vi.fn(), location: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  jobCategory: { findUnique: mock.categoryFind },
  serviceTemplate: { findUnique: mock.serviceFind },
  templateJob: { findUnique: mock.templateFind },
  marketplaceJob: { create: mock.jobCreate },
} }))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => ({ id: 'customer', countryCode: mock.account }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/geography/market-engine', () => ({ resolveMarketFromServiceAddress: mock.location }))
vi.mock('@/lib/rate-limit/middleware', () => ({ checkRateLimit: async () => ({ allowed: true }), userKey: vi.fn() }))
vi.mock('@/lib/pricing/engine', () => ({ calculatePrice: mock.price }))
vi.mock('@/lib/job-blast', () => ({ blastJobToTaskers: mock.blast }))
vi.mock('@/lib/settings', () => ({ getSetting: async () => 2 }))
vi.mock('@/lib/notifications', () => ({ notifyTaskerAssigned: vi.fn(), createNotification: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendExpoPush: vi.fn() }))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkIndividualProviderEligibility: vi.fn(), checkCompanyEligibility: vi.fn(),
}))

async function create(fields: Record<string, unknown> = {}) {
  const { POST } = await import('@/app/api/mobile/v2/jobs/route')
  return POST(new NextRequest('http://localhost/api/mobile/v2/jobs', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Repair plumbing', description: 'Leaking sink', categoryId: 'cat',
      budgetType: 'REQUEST_QUOTES', countryCode: mock.market,
      latitude: 49.26, longitude: -123.12, ...fields,
    }),
  }))
}
describe('Phase 01 — job creation validates canonical catalogue against address market', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.account = 'CA'
    mock.market = 'CA'
    mock.category = { id: 'cat', name: 'Plumbing', slug: 'plumbing', isActive: true, countries: '["CA"]' }
    mock.service = { id: 'service', jobCategoryId: 'cat', templateJobId: null, isActive: true, countryCode: 'CA', currency: 'CAD' }
    mock.job = { id: 'service-job', categoryId: 'cat', isActive: true, countries: '["CA"]', currency: 'CAD' }
    mock.categoryFind.mockImplementation(async () => mock.category)
    mock.serviceFind.mockImplementation(async () => mock.service)
    mock.templateFind.mockImplementation(async () => mock.job)
    mock.location.mockImplementation(() => ({ ok: true, countryCode: mock.market }))
    mock.jobCreate.mockImplementation(async ({ data }) => ({ id: 'created', ...data }))
    mock.price.mockResolvedValue({
      baseAmount: 0n, urgencyAmount: 0n, serviceModifiers: 0n,
      providerGross: 0n, platformFeeBps: 0, platformFeeAmount: 0n,
      customerTotal: 0n, currency: 'CAD', pricingVersion: 'test', ruleIds: [],
    })
    mock.blast.mockResolvedValue({ matched: 0 })
  })
  async function reject(fields: Record<string, unknown>, code: string) {
    const response = await create(fields)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code })
    expect(mock.jobCreate).not.toHaveBeenCalled()
    expect(mock.price).not.toHaveBeenCalled()
    expect(mock.blast).not.toHaveBeenCalled()
  }

  it('rejects Sri Lankan category in Vancouver', async () => {
    mock.category.countries = '["LK"]'
    await reject({}, 'CATEGORY_MARKET_MISMATCH')
  })
  it('rejects malformed category grants rather than falling back', async () => {
    mock.category.countries = '{invalid'
    await reject({}, 'CATEGORY_MARKET_MISMATCH')
  })
  it('rejects a service template belonging to Sri Lanka', async () => {
    mock.service.countryCode = 'LK'
    mock.service.currency = 'LKR'
    await reject({ serviceTemplateId: 'service' }, 'SERVICE_TEMPLATE_MARKET_MISMATCH')
  })
  it('rejects incorrect template country despite correct currency', async () => {
    mock.service.countryCode = 'LK'
    await reject({ serviceTemplateId: 'service' }, 'SERVICE_TEMPLATE_MARKET_MISMATCH')
  })
  it('rejects template currency mismatch for Vancouver', async () => {
    mock.service.currency = 'LKR'
    await reject({ serviceTemplateId: 'service' }, 'SERVICE_TEMPLATE_MARKET_MISMATCH')
  })
  it('rejects LK-only TemplateJob in Vancouver', async () => {
    mock.job.countries = '["LK"]'
    await reject({ templateJobId: 'service-job' }, 'TEMPLATE_JOB_MARKET_MISMATCH')
  })
  it('rejects wrong TemplateJob currency despite valid market', async () => {
    mock.job.currency = 'LKR'
    await reject({ templateJobId: 'service-job' }, 'TEMPLATE_JOB_MARKET_MISMATCH')
  })
  it('validates TemplateJob inherited from linked ServiceTemplate', async () => {
    mock.service.templateJobId = 'service-job'
    mock.job.countries = '["LK"]'
    await reject({ serviceTemplateId: 'service' }, 'TEMPLATE_JOB_MARKET_MISMATCH')
  })
  it('accepts valid CAD services on a Vancouver job', async () => {
    expect((await create({ serviceTemplateId: 'service', templateJobId: 'service-job' })).status).toBe(201)
    expect(mock.jobCreate).toHaveBeenCalledTimes(1)
  })
  it('accepts valid LKR services for Sri Lanka', async () => {
    mock.account = 'LK'; mock.market = 'LK'
    mock.category.countries = '["LK"]'
    mock.service.countryCode = 'LK'; mock.service.currency = 'LKR'
    mock.job.countries = '["LK"]'; mock.job.currency = 'LKR'
    expect((await create({ serviceTemplateId: 'service', templateJobId: 'service-job', postalCode: '00100' })).status).toBe(201)
    expect(mock.jobCreate).toHaveBeenCalledTimes(1)
  })
  it('rejects a forged client country when the address resolver says Vancouver', async () => {
    mock.category.countries = '["LK"]'
    await reject({ countryCode: 'LK' }, 'CATEGORY_MARKET_MISMATCH')
  })
})
