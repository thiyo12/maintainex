import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { isSeasonalOfferJobAvailableInMarket } from '@/lib/domain/seasonal-offer-market'

const mock = vi.hoisted(() => ({
  findMany: vi.fn(),
  runtime: vi.fn(),
  country: 'CA',
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { seasonalOffer: { findMany: mock.findMany } },
}))
vi.mock('@/lib/runtime/platform-runtime', () => ({
  getPlatformRuntimeConfig: mock.runtime,
}))
vi.mock('@/lib/api/request-country', () => ({
  requestCountry: () => mock.country,
}))

const caItem = {
  currency: 'CAD',
  price: 100.25,
  templateJob: {
    id: 'ca-job',
    name: 'Heat pump check',
    description: '',
    isActive: true,
    currency: 'CAD',
    countries: '["CA"]',
    category: { isActive: true, countries: '["CA"]' },
  },
}
const lkItem = {
  currency: 'LKR',
  price: 2000,
  templateJob: {
    ...caItem.templateJob, id: 'lk-job', currency: 'LKR',
    countries: '["LK"]',
    category: { isActive: true, countries: '["LK"]' },
  },
}
const offer = (season: string, jobs: any[]) => ({
  id: 'offer-' + season, season, country: 'CA', isActive: true,
  displayOrder: 1, jobs: jobs.map((x, i) => ({ id: 'row-' + i, ...x })),
})

describe('Phase 08 — seasonal offerings obey local catalogue eligibility', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.country = 'CA'
    mock.runtime.mockResolvedValue({
      maintenance: { enabled: false },
      channels: { mobile: true },
      offers: { visible: true },
      market: { available: true },
    })
    mock.findMany.mockResolvedValue([offer('general', [caItem, lkItem])])
  })

  it('accepts genuine active Canadian seasonal work with CAD prices', () => {
    expect(isSeasonalOfferJobAvailableInMarket(caItem, 'CA')).toBe(true)
  })

  it('refuses cross-market jobs and cross-market seasonal overrides', () => {
    expect(isSeasonalOfferJobAvailableInMarket(lkItem, 'CA')).toBe(false)
    expect(isSeasonalOfferJobAvailableInMarket({ ...caItem, currency: 'LKR' }, 'CA')).toBe(false)
    expect(isSeasonalOfferJobAvailableInMarket({ ...caItem, templateJob: { ...caItem.templateJob, currency: 'LKR' } }, 'CA')).toBe(false)
  })

  it('refuses unpublished jobs, inactive parents, malformed market grants and sub-cent prices', () => {
    expect(isSeasonalOfferJobAvailableInMarket({ ...caItem, templateJob: { ...caItem.templateJob, isActive: false } }, 'CA')).toBe(false)
    expect(isSeasonalOfferJobAvailableInMarket({ ...caItem, templateJob: { ...caItem.templateJob, category: { ...caItem.templateJob.category, isActive: false } } }, 'CA')).toBe(false)
    expect(isSeasonalOfferJobAvailableInMarket({ ...caItem, templateJob: { ...caItem.templateJob, countries: 'nonsense' } }, 'CA')).toBe(false)
    expect(isSeasonalOfferJobAvailableInMarket({ ...caItem, price: 15.001 }, 'CA')).toBe(false)
    expect(isSeasonalOfferJobAvailableInMarket(caItem, 'US')).toBe(false)
  })

  it('filters cross-market seasonal jobs from the mobile endpoint', async () => {
    const { GET } = await import('@/app/api/mobile/seasonal-offers/route')
    const res = await GET(new NextRequest('http://localhost/api/mobile/seasonal-offers?country=CA&season=general'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].jobs).toHaveLength(1)
    expect(data[0].jobs[0].templateJob.id).toBe('ca-job')
  })

  it('falls back to safe general offers when specific-season items are ineligible', async () => {
    mock.findMany.mockImplementation(async ({ where }: { where: { season: string } }) =>
      where.season === 'winter'
        ? [offer('winter', [lkItem])]
        : [offer('general', [caItem])]
    )
    const { GET } = await import('@/app/api/mobile/seasonal-offers/route')
    const res = await GET(new NextRequest('http://localhost/api/mobile/seasonal-offers?country=CA&season=winter'))
    const data = await res.json()
    expect(data.map((x: { id: string }) => x.id)).toEqual(['offer-general'])
    expect(data[0].jobs[0].templateJob.id).toBe('ca-job')
  })

  it('does not show the wrong market in the public web offers endpoint', async () => {
    const { GET } = await import('@/app/api/seasonal-offers/route')
    const res = await GET(new NextRequest('http://localhost/api/seasonal-offers'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].jobs.map((x: any) => x.templateJob.id)).toEqual(['ca-job'])
  })

  it('does not query unsupported mobile seasonal markets', async () => {
    const { GET } = await import('@/app/api/mobile/seasonal-offers/route')
    const res = await GET(new NextRequest('http://localhost/api/mobile/seasonal-offers?country=US'))
    expect(await res.json()).toEqual([])
    expect(mock.findMany).not.toHaveBeenCalled()
  })

  it('respects hidden seasonal-offer runtime configuration', async () => {
    mock.runtime.mockResolvedValue({
      maintenance: { enabled: false }, channels: { mobile: true },
      offers: { visible: false }, market: { available: true },
    })
    const { GET } = await import('@/app/api/mobile/seasonal-offers/route')
    const res = await GET(new NextRequest('http://localhost/api/mobile/seasonal-offers?country=CA'))
    expect(await res.json()).toEqual([])
    expect(mock.findMany).not.toHaveBeenCalled()
  })
})
