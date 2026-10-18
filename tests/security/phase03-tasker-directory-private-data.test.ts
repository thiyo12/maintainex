import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  user: { id: 'customer', countryCode: 'CA' },
  providers: vi.fn(),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => mock.user,
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { taskerProfile: { findMany: mock.providers } },
}))
const provider = {
  id: 'profile-ca',
  userId: 'user-ca',
  bio: 'Plumbing expert',
  hourlyRate: 60,
  skills: '["plumbing"]',
  serviceAreas: '["Vancouver","42 Water Street","Vancouver"]',
  rating: 4.5,
  completedJobs: 30,
  isVerified: true,
  verificationStatus: 'VERIFIED',
  isOnline: true,
  latitude: 49.2827,
  longitude: -123.1207,
  locationUpdatedAt: new Date('2030-01-01T00:00:00Z'),
  user: {
    id: 'user-ca', name: 'Provider Name',
    email: 'private@example.invalid', phone: '+10000000000',
  },
}
async function directory(query = '') {
  const { GET } = await import('@/app/api/mobile/taskers/route')
  const response = await GET(new NextRequest('http://localhost/api/mobile/taskers' + query))
  return { status: response.status, body: await response.json() }
}
describe('Phase 03 — provider discovery protects contact and precise location', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.user = { id: 'customer', countryCode: 'CA' }
    mock.providers.mockResolvedValue([provider])
  })

  it('returns only public names, broad service areas and aggregate provider metadata', async () => {
    const { status, body } = await directory()
    expect(status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].serviceAreas).toEqual(['Vancouver'])
    expect(body[0].user).toEqual({ id: 'user-ca', name: 'Provider Name' })
    expect(body[0].hourlyRate).toBe(60)
    expect(body[0].skills).toEqual(['plumbing'])
  })

  it('never serializes precise coordinates, tracking timestamps or contact fields', async () => {
    const { body } = await directory()
    const result = body[0]
    for (const privateField of ['latitude', 'longitude', 'locationUpdatedAt', 'email', 'phone']) {
      expect(result).not.toHaveProperty(privateField)
      expect(result.user).not.toHaveProperty(privateField)
    }
    expect(JSON.stringify(body)).not.toContain('private@example.invalid')
    expect(JSON.stringify(body)).not.toContain('42 Water Street')
    expect(JSON.stringify(body)).not.toContain('-123.1207')
  })

  it('never queries contact fields from the user table', async () => {
    await directory()
    const query = mock.providers.mock.calls[0][0]
    expect(query.include.user.select).toEqual({ id: true, name: true })
    expect(query.include.user.select).not.toHaveProperty('phone')
    expect(query.include.user.select).not.toHaveProperty('email')
  })

  it('filters out banned, suspended, inactive and unverified providers in the database query', async () => {
    await directory()
    const query = mock.providers.mock.calls[0][0].where
    expect(query).toMatchObject({
      isVerified: true,
      verificationStatus: 'VERIFIED',
      user: { isActive: true, isSuspended: false, isBanned: false },
    })
    expect(query.OR).toEqual([
      { countryCode: 'CA' },
      { countryCode: null, user: { countryCode: 'CA' } },
    ])
  })

  it('fails closed for unsupported country hints without querying providers', async () => {
    const { status, body } = await directory('?country=US')
    expect(status).toBe(200)
    expect(body).toMatchObject({ code: 'MARKET_NOT_SUPPORTED', taskers: [] })
    expect(mock.providers).not.toHaveBeenCalled()
  })
})
