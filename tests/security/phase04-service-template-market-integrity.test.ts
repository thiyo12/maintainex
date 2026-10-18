import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  runtime: vi.fn(),
  find: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { serviceTemplate: { findMany: mock.find } },
}))
vi.mock('@/lib/runtime/platform-runtime', () => ({ getPlatformRuntimeConfig: mock.runtime }))
const ca = {
  id: 'service-ca', name: 'Vancouver plumbing', slug: 'vancouver-plumbing',
  isActive: true, countryCode: 'CA', currency: 'CAD',
  description: '', questionsJson: '[]', defaultDurationMinutes: 60,
  priceMin: 50, priceMax: 80,
  jobCategory: { id: 'cat', name: 'Plumbing', slug: 'plumbing',
    isActive: true, countries: '["LK","CA"]' },
  templateJob: {
    id: 'job-ca', name: 'Pipe repair', typicalDurationMinutes: 60,
    isActive: true, countries: '["CA"]', currency: 'CAD',
    priceMin: 50, priceMax: 80,
  },
}
async function list(params = '?country=CA') {
  const { GET } = await import('@/app/api/mobile/v2/service-templates/route')
  const res = await GET(new NextRequest('http://localhost/api/mobile/v2/service-templates' + params))
  return { status: res.status, body: await res.json() }
}
describe('Phase 04 — V2 service templates follow bookable catalogue market grants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.find.mockResolvedValue([structuredClone(ca)])
    mock.runtime.mockResolvedValue({
      maintenance: { enabled: false }, channels: { mobile: true },
      catalog: { visible: true }, market: { available: true },
    })
  })
  it('lists an active, CAD-priced Vancouver service with a valid parent job', async () => {
    const { status, body } = await list()
    expect(status).toBe(200)
    expect(body.map((t: { id: string }) => t.id)).toEqual(['service-ca'])
  })
  it('continues to support independent templates without a linked TemplateJob', async () => {
    mock.find.mockResolvedValue([{ ...ca, templateJob: null }])
    expect((await list()).body).toHaveLength(1)
  })
  it('rejects wrong-currency service templates before any client sees their price', async () => {
    mock.find.mockResolvedValue([{ ...ca, currency: 'LKR' }])
    expect((await list()).body).toEqual([])
  })
  it('rejects templates under an inactive or wrong-market parent category', async () => {
    mock.find.mockResolvedValue([{ ...ca,
      jobCategory: { ...ca.jobCategory, isActive: false },
    }])
    expect((await list()).body).toEqual([])
    mock.find.mockResolvedValue([{ ...ca,
      jobCategory: { ...ca.jobCategory, countries: '["LK"]' },
    }])
    expect((await list()).body).toEqual([])
  })
  it('rejects a linked TemplateJob that is inactive or priced for the wrong currency', async () => {
    mock.find.mockResolvedValue([{ ...ca, templateJob: { ...ca.templateJob, isActive: false } }])
    expect((await list()).body).toEqual([])
    mock.find.mockResolvedValue([{ ...ca, templateJob: { ...ca.templateJob, currency: 'LKR' } }])
    expect((await list()).body).toEqual([])
  })
  it('rejects dual-market jobs that cannot have one correct currency in both markets', async () => {
    mock.find.mockResolvedValue([{ ...ca, templateJob: {
      ...ca.templateJob, countries: '["LK","CA"]',
    } }])
    expect((await list()).body).toEqual([])
  })
  it('rejects an unsupported market without querying service templates', async () => {
    const { status, body } = await list('?country=US')
    expect(status).toBe(200)
    expect(body).toEqual([])
    expect(mock.find).not.toHaveBeenCalled()
  })
  it('preserves independently priced Sri Lankan LKR templates', async () => {
    mock.find.mockResolvedValue([{
      ...ca, countryCode: 'LK', currency: 'LKR',
      templateJob: { ...ca.templateJob, currency: 'LKR', countries: '["LK"]' },
    }])
    expect((await list('?country=LK')).body).toHaveLength(1)
    expect(mock.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ countryCode: 'LK', isActive: true }),
    }))
  })
  it('suppresses the catalogue when the runtime disables its market', async () => {
    mock.runtime.mockResolvedValue({
      maintenance: { enabled: false }, channels: { mobile: true },
      catalog: { visible: true }, market: { available: false },
    })
    expect((await list()).body).toEqual([])
    expect(mock.find).not.toHaveBeenCalled()
  })
})
