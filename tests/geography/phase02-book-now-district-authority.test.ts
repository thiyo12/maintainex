import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  customerMarket: 'CA',
  book: vi.fn(),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: async () => ({ id: 'customer', countryCode: mock.customerMarket }),
  assertNotSuspended: () => null,
}))
vi.mock('@/lib/domain/book-now', () => ({ createBookNowJob: mock.book }))
vi.mock('@/lib/geography/geocoder', () => ({
  verifyServiceCoordinates: async (latitude: number) => ({
    ok: true, countryCode: latitude > 30 ? 'CA' : 'LK',
    locality: latitude > 30 ? 'Vancouver' : 'Colombo', district: null,
  }),
}))

const VANCOUVER = { latitude: 49.2827, longitude: -123.1207 }
const COLOMBO = { latitude: 6.9271, longitude: 79.8612 }
const RICHMOND = { latitude: 49.1667, longitude: -123.1337 }

async function book(fields: Record<string, unknown> = {}) {
  const { POST } = await import('@/app/api/mobile/v2/book-now/route')
  return POST(new NextRequest('http://localhost/api/mobile/v2/book-now', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      templateJobId: 'template', providerId: 'provider', providerType: 'INDIVIDUAL',
      date: '2030-01-02', timeSlot: 'morning', address: '123 Example Street',
      countryCode: 'CA', district: 'Vancouver', ...VANCOUVER, ...fields,
    }),
  }))
}

describe('Phase 02 — direct booking district must match verified address market', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.customerMarket = 'CA'
    mock.book.mockResolvedValue({ job: { id: 'booking' }, quote: { id: 'quote' }, notifiedCount: 1 })
  })

  async function denied(fields: Record<string, unknown>) {
    const result = await book(fields)
    expect(result.status).toBe(400)
    expect(await result.json()).toMatchObject({ code: 'SERVICE_DISTRICT_MISMATCH' })
    expect(mock.book).not.toHaveBeenCalled()
  }

  it('accepts Vancouver municipality with matching district', async () => {
    expect((await book()).status).toBe(201)
    expect(mock.book).toHaveBeenCalledWith(expect.objectContaining({
      countryCode: 'CA', district: 'Vancouver',
    }))
  })
  it('accepts Vancouver spelled in lowercase but stores the canonical label', async () => {
    expect((await book({ district: 'vancouver' })).status).toBe(201)
    expect(mock.book).toHaveBeenCalledWith(expect.objectContaining({ district: 'Vancouver' }))
  })
  it('rejects a Vancouver coordinate with the unrelated Colombo district', async () => {
    await denied({ district: 'Colombo' })
  })
  it('rejects a Vancouver coordinate with the neighbouring Burnaby district', async () => {
    await denied({ district: 'Burnaby' })
  })
  it('rejects unknown arbitrary districts in the Vancouver booking market', async () => {
    await denied({ district: 'Toronto' })
  })
  it('accepts Sri Lankan coordinates with an official Colombo district', async () => {
    mock.customerMarket = 'LK'
    const result = await book({ ...COLOMBO, countryCode: 'LK', district: 'Colombo' })
    expect(result.status).toBe(201)
    expect(mock.book).toHaveBeenCalledWith(expect.objectContaining({ countryCode: 'LK', district: 'Colombo' }))
  })
  it('rejects an unsupported Sri Lankan district instead of trusting caller text', async () => {
    mock.customerMarket = 'LK'
    await denied({ ...COLOMBO, countryCode: 'LK', district: 'Ontario' })
  })
  it('rejects locations outside Vancouver before booking a provider', async () => {
    const result = await book({ ...RICHMOND })
    expect(result.status).toBe(400)
    expect(mock.book).not.toHaveBeenCalled()
  })
  it.each([
    ['Template job is not available in booking country', 403],
    ['Unsupported booking country', 400],
    ['Booking country is required', 400],
    ['Provider is not eligible for the job', 403],
    ['Provider currently unavailable', 409],
  ])('returns HTTP %s domain errors as the correct client status for %s',
    async (message, expectedStatus) => {
      mock.book.mockRejectedValueOnce(new Error(message))
      const response = await book()
      expect(response.status).toBe(expectedStatus)
      expect(await response.json()).toMatchObject({ error: message })
      expect(mock.book).toHaveBeenCalledTimes(1)
    },
  )

  it('keeps unexpected domain failures as generic 500 responses', async () => {
    mock.book.mockRejectedValueOnce(new Error('Sensitive internal connection failure'))
    const response = await book()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Server error' })
  })

  it('retains account-country mismatch protection', async () => {
    mock.customerMarket = 'LK'
    const result = await book({ countryCode: 'LK', district: 'Vancouver' })
    expect(result.status).toBe(403)
    expect(mock.book).not.toHaveBeenCalled()
  })
})
