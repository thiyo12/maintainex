import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  profiles: vi.fn(), active: vi.fn(), quotes: vi.fn(), setting: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: {
  taskerProfile: { findMany: mock.profiles },
  marketplaceJob: { findMany: mock.active },
  jobQuote: { findMany: mock.quotes },
} }))
vi.mock('@/lib/settings', () => ({ getSetting: mock.setting }))
function profile(extra: Record<string, unknown> = {}) {
  return {
    id: 'profile-1', userId: 'tasker-1',
    isVerified: true, verificationStatus: 'VERIFIED',
    isOnline: true, countryCode: 'CA',
    latitude: 49.2827, longitude: -123.1207, serviceRadius: 10,
    skills: '["plumbing"]', rating: 4.8, completedJobs: 8, compositeScore: 80,
    user: { id: 'tasker-1', name: 'Test', email: 'provider@example.invalid',
      pushToken: null, isActive: true, isSuspended: false,
      suspendedUntil: null, isBanned: false },
    ...extra,
  }
}
async function match(extra: Record<string, unknown> = {}) {
  const { matchTaskerCandidates } = await import('@/lib/job-matching')
  return matchTaskerCandidates({
    matchKeys: ['plumbing'], countryCode: 'CA',
    lat: 49.2827, lng: -123.1207, radiusKm: 20,
    ...extra,
  })
}
describe('Phase 03 — compatibility matcher cannot bypass verification or radius', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.active.mockResolvedValue([])
    mock.quotes.mockResolvedValue([])
    mock.setting.mockResolvedValue(20)
    mock.profiles.mockResolvedValue([profile()])
  })
  it('returns a nearby verified individual provider', async () => {
    const candidates = await match()
    expect(candidates).toHaveLength(1)
    expect(candidates[0].profile.userId).toBe('tasker-1')
    expect(candidates[0].distanceKm).toBeCloseTo(0, 2)
  })
  it('requires full VERIFIED profile status in the database query', async () => {
    await match()
    expect(mock.profiles).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isVerified: true, verificationStatus: 'VERIFIED', countryCode: 'CA',
      }),
    }))
  })
  it('requires full verification even for explicitly targeted providers', async () => {
    await match({ targetTaskerId: 'tasker-1' })
    expect(mock.profiles).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'tasker-1', isVerified: true,
        verificationStatus: 'VERIFIED', countryCode: 'CA',
      }),
    }))
  })
  it.each([
    ['missing both', { latitude: null, longitude: null }],
    ['missing latitude', { latitude: null }],
    ['missing longitude', { longitude: null }],
    ['not finite latitude', { latitude: NaN }],
    ['not finite longitude', { longitude: Infinity }],
    ['out-of-range latitude', { latitude: 95 }],
    ['out-of-range longitude', { longitude: -181 }],
  ])('never treats %s provider GPS as satisfying a distance-constrained search',
    async (_label, data) => {
      mock.profiles.mockResolvedValue([profile(data)])
      expect(await match()).toEqual([])
    })
  it('excludes providers outside their declared service radius', async () => {
    mock.profiles.mockResolvedValue([profile({
      latitude: 49.2, longitude: -123.2, serviceRadius: 2,
    })])
    expect(await match()).toEqual([])
  })
  it('preserves category browsing without customer GPS for legacy callers', async () => {
    mock.profiles.mockResolvedValue([profile({ latitude: null, longitude: null })])
    expect(await match({ lat: null, lng: null })).toHaveLength(1)
  })
  it('never matches a busy provider already handling a job', async () => {
    mock.active.mockResolvedValue([{ id: 'in-progress-job' }])
    mock.quotes.mockResolvedValue([{ providerId: 'tasker-1' }])
    expect(await match()).toEqual([])
  })
  it('rejects banned or suspended provider accounts even if profile is verified', async () => {
    mock.profiles.mockResolvedValue([
      profile({ userId: 'banned', user: { ...profile().user, isBanned: true } }),
      profile({ userId: 'suspended', user: { ...profile().user, isSuspended: true } }),
    ])
    expect(await match()).toEqual([])
  })
  it.each([
    ['latitude only', { lat: 49.2827, lng: null }],
    ['longitude only', { lat: null, lng: -123.1207 }],
    ['NaN latitude', { lat: NaN, lng: -123.1207 }],
    ['infinite longitude', { lat: 49.2827, lng: Infinity }],
    ['outside launch markets', { lat: 0, lng: 0 }],
    ['Burnaby with Vancouver country', { lat: 49.2596, lng: -122.998 }],
    ['Colombo with Canadian market', { lat: 6.9271, lng: 79.8612 }],
  ])('rejects %s at matcher boundary without reading candidate profiles', async (_label, coords) => {
    expect(await match(coords)).toEqual([])
    expect(mock.profiles).not.toHaveBeenCalled()
  })
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid radius %s before querying candidate profiles', async radiusKm => {
      expect(await match({ radiusKm })).toEqual([])
      expect(mock.profiles).not.toHaveBeenCalled()
    },
  )
  it('still accepts valid coordinates in the Sri Lankan launch market', async () => {
    mock.profiles.mockResolvedValue([profile({
      countryCode: 'LK', latitude: 6.9271, longitude: 79.8612,
    })])
    const candidates = await match({
      countryCode: 'LK', lat: 6.9271, lng: 79.8612,
    })
    expect(candidates).toHaveLength(1)
    expect(mock.profiles).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ countryCode: 'LK' }),
    }))
  })
  it('never queries providers across all markets if the market is unknown', async () => {
    await match({ countryCode: undefined })
    expect(mock.profiles).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ countryCode: '__none__' }),
    }))
  })
})
