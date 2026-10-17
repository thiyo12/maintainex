import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  findMany: vi.fn(),
  runtime: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { jobCategory: { findMany: mock.findMany } },
}))
vi.mock('@/lib/runtime/platform-runtime', () => ({
  getPlatformRuntimeConfig: mock.runtime,
}))

const category = {
  id: 'category',
  name: 'Plumbing',
  slug: 'plumbing',
  iconName: 'Wrench',
  colorHex: null,
  sortOrder: 1,
  countries: '["LK","CA"]',
  isActive: true,
}
const job = {
  id: 'job',
  categoryId: 'category',
  name: 'Repair',
  description: 'Repair service',
  whatIsIncluded: '[]',
  typicalDurationMinutes: 60,
  priceMin: 0,
  priceMax: 0,
  currency: 'CAD',
  isPopular: false,
  isCompanyOnly: false,
  countries: '["CA"]',
}

async function catalogue(country: string) {
  const { GET } = await import('@/app/api/mobile/job-categories/route')
  return GET(new NextRequest('http://localhost/api/mobile/job-categories?country=' + country))
}

describe('Phase 04 — onboarding catalogue filters each canonical service by market', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.runtime.mockResolvedValue({
      maintenance: { enabled: false },
      channels: { mobile: true },
      catalog: { visible: true },
      market: { available: true },
    })
    mock.findMany.mockResolvedValue([{
      ...category,
      jobs: [
        { ...job, id: 'ca-valid' },
        { ...job, id: 'lk-valid', currency: 'LKR', countries: '["LK"]' },
        { ...job, id: 'ca-bad-currency', currency: 'LKR' },
        { ...job, id: 'lk-bad-currency', currency: 'CAD', countries: '["LK"]' },
      ],
    }])
  })

  it('includes only CA/CAD services for Canadian company onboarding', async () => {
    const response = await catalogue('CA')
    expect(response.status).toBe(200)
    const rows = await response.json()
    expect(rows).toHaveLength(1)
    expect(rows[0].jobs.map((j: { id: string }) => j.id)).toEqual(['ca-valid'])
  })

  it('includes only LK/LKR services for Sri Lankan company onboarding', async () => {
    const response = await catalogue('LK')
    expect(response.status).toBe(200)
    const rows = await response.json()
    expect(rows[0].jobs.map((j: { id: string }) => j.id)).toEqual(['lk-valid'])
  })

  it('never invents a default currency for unsupported market codes', async () => {
    const response = await catalogue('US')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
    expect(mock.findMany).not.toHaveBeenCalled()
  })

  it('omits departments with no active CA/CAD services', async () => {
    mock.findMany.mockResolvedValue([{
      ...category, jobs: [{ ...job, countries: '["LK"]', currency: 'LKR' }],
    }])
    const response = await catalogue('CA')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })

  it('omits departments with no active LK/LKR services', async () => {
    mock.findMany.mockResolvedValue([{
      ...category, jobs: [{ ...job, countries: '["CA"]', currency: 'CAD' }],
    }])
    const response = await catalogue('LK')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })

  it('preserves departments that retain any eligible service in the market', async () => {
    mock.findMany.mockResolvedValue([{
      ...category, jobs: [
        { ...job, id: 'lk', countries: '["LK"]', currency: 'LKR' },
        { ...job, id: 'ca', countries: '["CA"]', currency: 'CAD' },
      ],
    }])
    const response = await catalogue('CA')
    expect((await response.json())[0].jobs.map((j: { id: string }) => j.id)).toEqual(['ca'])
  })

  it('keeps market-scoped parent categories unchanged', async () => {
    mock.findMany.mockResolvedValue([{
      ...category,
      countries: '["LK"]',
      jobs: [{ ...job, id: 'hidden-job' }],
    }])
    const response = await catalogue('CA')
    expect((await response.json())).toEqual([])
  })
})
