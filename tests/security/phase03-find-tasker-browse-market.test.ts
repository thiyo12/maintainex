import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  account: 'CA',
  template: {
    id: 'job', isActive: true, countries: '["CA"]', currency: 'CAD',
    category: { id: 'cat', isActive: true, countries: '["CA"]' },
  } as any,
  find: vi.fn(), keys: vi.fn(), match: vi.fn(), setting: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: { templateJob: { findUnique: mock.find } } }))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => ({ id: 'customer', countryCode: mock.account }),
}))
vi.mock('@/lib/job-matching', () => ({
  resolveJobCategoryKeys: mock.keys, matchTaskerCandidates: mock.match,
}))
vi.mock('@/lib/settings', () => ({ getSetting: mock.setting }))

async function browse(params = '') {
  const { GET } = await import('@/app/api/mobile/find-tasker/route')
  const res = await GET(new NextRequest('http://localhost/api/mobile/find-tasker?jobId=job' + params))
  return { status: res.status, body: await res.json() }
}
describe('Phase 03 — compatibility provider browse must enforce the service market', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.account = 'CA'
    mock.template = {
      id: 'job', isActive: true, countries: '["CA"]', currency: 'CAD',
      category: { id: 'cat', isActive: true, countries: '["CA"]' },
    }
    mock.find.mockImplementation(async () => mock.template)
    mock.keys.mockResolvedValue({ keys: ['plumbing'], name: 'Plumbing' })
    mock.match.mockResolvedValue([])
    mock.setting.mockResolvedValue(50)
  })
  async function denied(params: string, expected: string) {
    const { body } = await browse(params)
    expect(body).toMatchObject({ code: expected, candidates: [] })
    expect(mock.match).not.toHaveBeenCalled()
  }
  it('allows active, Canadian-priced catalogue browsing without GPS for compatibility', async () => {
    const { status, body } = await browse()
    expect(status).toBe(200)
    expect(body).toEqual([])
    expect(mock.match).toHaveBeenCalledWith(expect.objectContaining({ countryCode: 'CA' }))
  })
  it('allows verified coordinates inside Vancouver municipality', async () => {
    const { status } = await browse('&latitude=49.2827&longitude=-123.1207')
    expect(status).toBe(200)
    expect(mock.match).toHaveBeenCalledWith(expect.objectContaining({
      lat: 49.2827, lng: -123.1207, countryCode: 'CA',
    }))
  })
  it('rejects Burnaby coordinates even if caller claims Canada', async () => {
    const result = await browse('&country=CA&latitude=49.2596&longitude=-122.998')
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({ code: 'LOCATION_MARKET_MISMATCH' })
    expect(mock.match).not.toHaveBeenCalled()
  })
  it('rejects Colombo coordinates with a Canadian market hint', async () => {
    const res = await browse('&latitude=6.9271&longitude=79.8612')
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ code: 'LOCATION_MARKET_MISMATCH' })
    expect(mock.match).not.toHaveBeenCalled()
  })
  it('rejects partial GPS coordinates before candidate matching', async () => {
    const res = await browse('&latitude=49.2827')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('LOCATION_REQUIRES_VERIFICATION')
    expect(mock.match).not.toHaveBeenCalled()
  })
  it('does not default an explicitly malformed country hint to account market', async () => {
    await denied('&country=CA123', 'MARKET_NOT_SUPPORTED')
  })
  it('does not list providers for wrong-market or wrong-currency TemplateJobs', async () => {
    mock.template.countries = '["LK"]'
    await denied('', 'SERVICE_MARKET_UNAVAILABLE')
    mock.template.countries = '["CA"]'
    mock.template.currency = 'LKR'
    await denied('', 'SERVICE_MARKET_UNAVAILABLE')
  })
  it('does not list providers for an inactive service or category', async () => {
    mock.template.isActive = false
    expect((await browse()).status).toBe(404)
    expect(mock.match).not.toHaveBeenCalled()
    mock.template.isActive = true
    mock.template.category.isActive = false
    await denied('', 'SERVICE_MARKET_UNAVAILABLE')
  })
  it('rejects single-currency dual-market jobs', async () => {
    mock.template.countries = '["LK","CA"]'
    await denied('', 'SERVICE_MARKET_UNAVAILABLE')
  })
  it('preserves Sri Lankan discovery for a valid LKR job', async () => {
    mock.account = 'LK'
    mock.template.currency = 'LKR'
    mock.template.countries = '["LK"]'
    mock.template.category.countries = '["LK"]'
    const res = await browse('&country=LK&latitude=6.9271&longitude=79.8612')
    expect(res.status).toBe(200)
    expect(mock.match).toHaveBeenCalledWith(expect.objectContaining({ countryCode: 'LK' }))
  })
})
