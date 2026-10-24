import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  account: 'CA', market: 'CA' as 'CA' | 'LK',
  category: { id: 'cat', name: 'Plumbing', slug: 'plumbing', isActive: true, countries: '["CA"]' },
  service: { id: 'service', jobCategoryId: 'cat', templateJobId: null as string | null, isActive: true, countryCode: 'CA', currency: 'CAD' },
  job: { id: 'service-job', categoryId: 'cat', isActive: true, countries: '["CA"]', currency: 'CAD' },
  area: { city: { name: 'Vancouver', state: { name: 'British Columbia', country: { code: 'CA' } } } } as null | { city: { name: string; state: { name: string; country: { code: string } } } },
  areaFind: vi.fn(),
  categoryFind: vi.fn(), serviceFind: vi.fn(), templateFind: vi.fn(),
  jobCreate: vi.fn(), price: vi.fn(), blast: vi.fn(), location: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  area: { findUnique: mock.areaFind },
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
vi.mock('@/lib/geography/geocoder', () => ({
  verifyServiceCoordinates: async (latitude: number) => ({
    ok: true, countryCode: latitude > 30 ? 'CA' : 'LK',
    locality: latitude > 30 ? 'Vancouver' : 'Colombo', district: null,
  }),
}))
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
    mock.area = { city: { name: 'Vancouver', state: { name: 'British Columbia', country: { code: 'CA' } } } }
    mock.areaFind.mockImplementation(async () => mock.area)
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
    expect((await create({ serviceTemplateId: 'service', templateJobId: 'service-job', postalCode: '00100', latitude: 6.9271, longitude: 79.8612 })).status).toBe(201)
    expect(mock.jobCreate).toHaveBeenCalledTimes(1)
  })


  it('keeps Vancouver area IDs when the city and country both match', async () => {
    const response = await create({ areaId: 'van-area' })
    expect(response.status).toBe(201)
    expect(mock.areaFind).toHaveBeenCalledWith({
      where: { id: 'van-area' },
      select: { city: { select: { name: true, state: { select: { name: true, country: { select: { code: true } } } } } } },
    })
    expect(mock.jobCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ areaId: 'van-area', countryCode: 'CA' }),
    }))
  })

  it('rejects a Vancouver-named area located in Ontario', async () => {
    mock.area = { city: { name: 'Vancouver', state: { name: 'Ontario', country: { code: 'CA' } } } }
    await reject({ areaId: 'ontario-van' }, 'AREA_MARKET_MISMATCH')
  })

  it('accepts the BC province abbreviation as a valid Vancouver area', async () => {
    mock.area = { city: { name: 'Vancouver', state: { name: 'BC', country: { code: 'CA' } } } }
    expect((await create({ areaId: 'vancouver-bc' })).status).toBe(201)
    expect(mock.jobCreate).toHaveBeenCalledTimes(1)
  })

  it('rejects Vancouver booking tied to a Burnaby area', async () => {
    mock.area = { city: { name: 'Burnaby', state: { name: 'British Columbia', country: { code: 'CA' } } } }
    await reject({ areaId: 'burnaby-area' }, 'AREA_MARKET_MISMATCH')
  })

  it('rejects Vancouver booking tied to a North Vancouver area', async () => {
    mock.area = { city: { name: 'North Vancouver', state: { name: 'British Columbia', country: { code: 'CA' } } } }
    await reject({ areaId: 'north-van-area' }, 'AREA_MARKET_MISMATCH')
  })

  it('rejects a Sri Lankan area ID for a Vancouver booking', async () => {
    mock.area = { city: { name: 'Colombo', state: { name: 'Western Province', country: { code: 'LK' } } } }
    await reject({ areaId: 'colombo-area' }, 'AREA_MARKET_MISMATCH')
  })

  it('rejects a missing or stale area ID before pricing or job creation', async () => {
    mock.area = null
    await reject({ areaId: 'deleted-area' }, 'AREA_MARKET_MISMATCH')
  })

  it('accepts a valid Sri Lankan area ID when the market is LK', async () => {
    mock.account = 'LK'
    mock.market = 'LK'
    mock.category.countries = '["LK"]'
    mock.area = { city: { name: 'Kandy', state: { name: 'Western Province', country: { code: 'LK' } } } }
    const response = await create({ areaId: 'kandy-area', latitude: 7.2906, longitude: 80.6337 })
    expect(response.status).toBe(201)
    expect(mock.jobCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ areaId: 'kandy-area', countryCode: 'LK' }),
    }))
  })

  it('rejects a Canadian area ID on a Sri Lankan booking', async () => {
    mock.account = 'LK'
    mock.market = 'LK'
    mock.category.countries = '["LK"]'
    await reject({ areaId: 'van-area', latitude: 7.2906, longitude: 80.6337 }, 'AREA_MARKET_MISMATCH')
  })

  it('rejects malformed areaId values before database lookup', async () => {
    const response = await create({ areaId: { id: 'van-area' } })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_AREA_ID' })
    expect(mock.areaFind).not.toHaveBeenCalled()
    expect(mock.jobCreate).not.toHaveBeenCalled()
  })

  it('does not require area lookup for old clients that omit areaId', async () => {
    expect((await create()).status).toBe(201)
    expect(mock.areaFind).not.toHaveBeenCalled()
  })

  it('does not accept latitude-only coordinates with a Sri Lankan postal code', async () => {
    mock.account = 'LK'; mock.market = 'LK'
    const response = await create({ latitude: 49.2827, longitude: null, postalCode: '00100' })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ADDRESS_REQUIRES_VERIFICATION' })
    expect(mock.location).not.toHaveBeenCalled()
    expect(mock.jobCreate).not.toHaveBeenCalled()
  })

  it('rejects longitude-only coordinates before the address market fallback', async () => {
    mock.account = 'LK'; mock.market = 'LK'
    const response = await create({ latitude: null, longitude: 79.8612, postalCode: '00100' })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ADDRESS_REQUIRES_VERIFICATION' })
    expect(mock.location).not.toHaveBeenCalled()
    expect(mock.jobCreate).not.toHaveBeenCalled()
  })

  it('does not convert coordinate strings to missing coordinates', async () => {
    mock.account = 'LK'; mock.market = 'LK'
    const response = await create({ latitude: '6.9271', longitude: '79.8612', postalCode: '00100' })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ADDRESS_REQUIRES_VERIFICATION' })
    expect(mock.location).not.toHaveBeenCalled()
    expect(mock.jobCreate).not.toHaveBeenCalled()
  })

  it('rejects a malformed coordinate while retaining a plausible postal code', async () => {
    mock.account = 'LK'; mock.market = 'LK'
    const response = await create({ latitude: 'bad', longitude: 79.8612, postalCode: '00100' })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'ADDRESS_REQUIRES_VERIFICATION' })
    expect(mock.location).not.toHaveBeenCalled()
    expect(mock.jobCreate).not.toHaveBeenCalled()
  })

  it('rejects a forged client country when the address resolver says Vancouver', async () => {
    mock.category.countries = '["LK"]'
    await reject({ countryCode: 'LK' }, 'CATEGORY_MARKET_MISMATCH')
  })
})
