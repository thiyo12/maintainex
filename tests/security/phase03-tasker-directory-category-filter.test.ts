import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  account: 'CA',
  providers: vi.fn(), category: vi.fn(), categories: vi.fn(),
  legacy: vi.fn(), legacyFind: vi.fn(), services: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  taskerProfile: { findMany: mock.providers },
  jobCategory: { findFirst: mock.category, findMany: mock.categories },
  category: { findMany: mock.legacy, findFirst: mock.legacyFind },
  templateJob: { findMany: mock.services },
} }))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => ({ id: 'customer', countryCode: mock.account }),
}))
const cat = {
  id: 'plumb-id', slug: 'plumbing', name: 'Plumbing',
  isActive: true, countries: '["CA"]',
}
const provider = {
  id: 'p1', userId: 'u1', user: { id: 'u1', name: 'Plumber' },
  bio: '', hourlyRate: 75, skills: '["plumb-id","legacy-plumb"]',
  serviceAreas: '["Vancouver"]', rating: 5, completedJobs: 8,
  isVerified: true, isOnline: true,
}
async function browse(query = '?category=plumbing') {
  const { GET } = await import('@/app/api/mobile/taskers/route')
  const res = await GET(new NextRequest('http://localhost/api/mobile/taskers' + query))
  return { status: res.status, body: await res.json() }
}
describe('Phase 03 — provider directory category filters cannot fall open', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.account = 'CA'
    mock.providers.mockResolvedValue([provider])
    mock.category.mockResolvedValue({ ...cat })
    mock.categories.mockResolvedValue([{ ...cat }])
    mock.legacy.mockResolvedValue([])
    mock.legacyFind.mockResolvedValue(null)
    mock.services.mockResolvedValue([{ countries: '["CA"]', currency: 'CAD' }])
  })
  it('returns a provider with an active, priced, Canadian category skill', async () => {
    const r = await browse()
    expect(r.status).toBe(200)
    expect(r.body.map((p: { id: string }) => p.id)).toEqual(['p1'])
    expect(mock.services).toHaveBeenCalledWith({
      where: { categoryId: 'plumb-id', isActive: true },
      select: { currency: true, countries: true },
    })
  })
  it('returns nobody for an unknown category instead of listing every provider', async () => {
    mock.category.mockResolvedValue(null)
    const r = await browse('?category=not-a-real-service')
    expect(r.body).toEqual([])
  })
  it('returns nobody for an inactive or wrong-country V2 category', async () => {
    mock.category.mockResolvedValue({ ...cat, isActive: false })
    expect((await browse()).body).toEqual([])
    mock.category.mockResolvedValue({ ...cat, countries: '["LK"]' })
    expect((await browse()).body).toEqual([])
  })
  it('returns nobody when no active priced services exist in that category', async () => {
    mock.services.mockResolvedValue([])
    expect((await browse()).body).toEqual([])
  })
  it('returns nobody for wrong-currency and dual-country single-price jobs', async () => {
    mock.services.mockResolvedValue([{ countries: '["CA"]', currency: 'LKR' }])
    expect((await browse()).body).toEqual([])
    mock.services.mockResolvedValue([{ countries: '["LK","CA"]', currency: 'CAD' }])
    expect((await browse()).body).toEqual([])
  })
  it('preserves an active legacy service slug linked to a bookable V2 category', async () => {
    mock.category.mockResolvedValue(null)
    mock.legacyFind.mockResolvedValue({ name: 'Plumbing', slug: 'legacy-plumb' })
    const r = await browse('?category=legacy-plumb')
    expect(r.body.map((p: { id: string }) => p.id)).toEqual(['p1'])
  })
  it('rejects unmapped legacy category names', async () => {
    mock.category.mockResolvedValue(null)
    mock.legacyFind.mockResolvedValue({ name: 'Unrelated Seasonal', slug: 'legacy-seasonal' })
    expect((await browse('?category=legacy-seasonal')).body).toEqual([])
  })
  it('does not affect unfiltered provider browsing', async () => {
    const res = await browse('')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(mock.category).not.toHaveBeenCalled()
  })
})
