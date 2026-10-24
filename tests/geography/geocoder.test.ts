import { describe, expect, it, vi } from 'vitest'
import { verifyServiceCoordinates } from '@/lib/geography/geocoder'

const googleResponse = (country: string, locality: string | null = null) => ({
  status: 'OK',
  results: [{ address_components: [
    { long_name: country === 'CA' ? 'Canada' : 'Sri Lanka', short_name: country, types: ['country', 'political'] },
    ...(locality ? [{ long_name: locality, short_name: locality, types: ['locality', 'political'] }] : []),
  ] }],
})

describe('server-side service address geocoder', () => {
  it('fails closed when the server-only key is missing', async () => {
    const result = await verifyServiceCoordinates(49.28, -123.12, { apiKey: '' })
    expect(result).toEqual({ ok: false, code: 'GEOCODER_NOT_CONFIGURED' })
  })

  it('rejects invalid coordinates before making an outbound request', async () => {
    const fetcher = vi.fn()
    const result = await verifyServiceCoordinates(200, -123.12, { apiKey: 'test', fetcher: fetcher as any })
    expect(result).toEqual({ ok: false, code: 'ADDRESS_NOT_VERIFIED' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('uses only the fixed Google endpoint and resolves Vancouver from the returned country/locality', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => googleResponse('CA', 'Vancouver') })
    const result = await verifyServiceCoordinates(49.28, -123.12, { apiKey: 'mock-key', fetcher: fetcher as any })
    expect(result).toEqual({ ok: true, countryCode: 'CA', locality: 'Vancouver', district: null })
    const [url, options] = fetcher.mock.calls[0]
    expect(new URL(url).origin).toBe('https://maps.googleapis.com')
    expect(new URL(url).pathname).toBe('/maps/api/geocode/json')
    expect(new URL(url).searchParams.get('key')).toBe('mock-key')
    expect(options.redirect).toBe('error')
  })

  it('distinguishes an unsupported location from a provider outage', async () => {
    const zeroResults = await verifyServiceCoordinates(6.9, 79.8, {
      apiKey: 'mock-key', fetcher: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ZERO_RESULTS' }) }) as any,
    })
    const outage = await verifyServiceCoordinates(6.9, 79.8, {
      apiKey: 'mock-key', fetcher: vi.fn().mockRejectedValue(new Error('network')) as any,
    })
    expect(zeroResults).toEqual({ ok: false, code: 'ADDRESS_NOT_VERIFIED' })
    expect(outage).toEqual({ ok: false, code: 'GEOCODER_UNAVAILABLE' })
  })
})
