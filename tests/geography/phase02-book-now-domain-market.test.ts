import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  template: vi.fn(),
  category: vi.fn(),
  provider: vi.fn(),
  pricing: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    templateJob: { findUnique: mock.template },
    jobCategory: { findUnique: mock.category },
    taskerProfile: { findFirst: mock.provider },
  },
}))
vi.mock('@/lib/pricing/engine', () => ({ calculatePrice: mock.pricing }))
vi.mock('@/lib/phase6/provider-eligibility', () => ({
  checkIndividualProviderEligibility: vi.fn(),
  checkCompanyEligibility: vi.fn(),
  checkWorkerEligibility: vi.fn(),
}))

const input = {
  customerId: 'customer', templateJobId: 'lk-template',
  providerId: 'provider', providerType: 'INDIVIDUAL' as const,
  scheduledDate: new Date('2030-01-01T08:00:00Z'),
  timeSlot: 'morning', address: '123 Test Street',
  district: 'Colombo', countryCode: 'LK',
}
async function booking(fields: Record<string, unknown>) {
  const { createBookNowJob } = await import('@/lib/domain/book-now')
  return createBookNowJob({ ...input, ...fields })
}
describe('Phase 02 — domain BOOK_NOW callers cannot bypass verified GPS market', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.template.mockResolvedValue({
      id: 'lk-template', categoryId: 'category',
      isActive: true, countries: '["LK"]', currency: 'LKR',
    })
    mock.category.mockResolvedValue({ isActive: true, countries: '["LK"]' })
  })
  async function rejected(fields: Record<string, unknown>) {
    await expect(booking(fields)).rejects.toThrow('Service address does not match booking country')
    expect(mock.category).not.toHaveBeenCalled()
    expect(mock.provider).not.toHaveBeenCalled()
    expect(mock.pricing).not.toHaveBeenCalled()
  }
  it('rejects Vancouver coordinates claimed as a Sri Lankan booking', async () => {
    await rejected({ latitude: 49.2827, longitude: -123.1207 })
  })
  it('rejects Colombo coordinates claimed as a Canadian booking', async () => {
    await rejected({ countryCode: 'CA', district: 'Vancouver',
      latitude: 6.9271, longitude: 79.8612 })
  })
  it('rejects Burnaby coordinates even with a Vancouver district hint', async () => {
    await rejected({ countryCode: 'CA', district: 'Vancouver',
      latitude: 49.2596, longitude: -122.998 })
  })
  it.each([
    ['latitude without longitude', { latitude: 6.9271 }],
    ['longitude without latitude', { longitude: 79.8612 }],
    ['nonfinite latitude', { latitude: Number.NaN, longitude: 79.8612 }],
    ['out-of-bounds longitude', { latitude: 6.9271, longitude: 200 }],
  ])('rejects %s before provider resolution or pricing', async (_label, fields) => {
    await rejected(fields)
  })
  it('rejects a mismatched Canadian district even within the Vancouver polygon', async () => {
    await rejected({ countryCode: 'CA', district: 'Burnaby',
      latitude: 49.2827, longitude: -123.1207 })
  })
  it('preserves coordinate-less LK jobs up to the normal capability requirements', async () => {
    await expect(booking({})).rejects.not.toThrow('Service address does not match booking country')
    expect(mock.category).toHaveBeenCalledTimes(1)
  })
})
