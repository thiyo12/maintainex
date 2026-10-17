import { beforeEach, describe, expect, it, vi } from 'vitest'

// Test the actual mobile V2 endpoint. The historical static fallback includes
// Toronto, so a database outage must not reintroduce it to the address picker.
const mock = vi.hoisted(() => ({
  findCountries: vi.fn(),
  getRuntime: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { country: { findMany: mock.findCountries } },
}))
vi.mock('@/lib/runtime/platform-runtime', () => ({
  getPlatformRuntimeConfig: mock.getRuntime,
}))

async function locations() {
  const { GET } = await import('@/app/api/mobile/v2/locations/route')
  const response = await GET()
  return { response, body: await response.json() }
}
function cities(country: { states: Array<{ cities: Array<{ name: string }> }> }) {
  return country.states.flatMap(state => state.cities.map(city => city.name))
}

describe('Phase 02 — launch locations stay scoped during normal and fallback reads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.getRuntime.mockResolvedValue({
      market: { availableMarkets: ['LK', 'CA'] },
    })
    mock.findCountries.mockResolvedValue([])
  })

  it('never exposes historical Toronto when the country DB is empty', async () => {
    const { response, body } = await locations()
    expect(response.status).toBe(200)
    expect(body.source).toBe('static-fallback')
    expect(body.countries.map((country: { code: string }) => country.code).sort()).toEqual(['CA', 'LK'])
    expect(cities(body.countries.find((country: { code: string }) => country.code === 'CA'))).toEqual(['Vancouver'])
  })

  it('filters historical Toronto on DB failure instead of returning raw fallback', async () => {
    mock.findCountries.mockRejectedValue(new Error('Database offline'))
    const { response, body } = await locations()
    expect(response.status).toBe(200)
    expect(response.headers.get('X-MaintainEX-Location-Fallback')).toBe('1')
    expect(body.source).toBe('static-fallback')
    expect(cities(body.countries.find((c: { code: string }) => c.code === 'CA'))).toEqual(['Vancouver'])
  })

  it('does not offer the UBC campus as a City of Vancouver launch neighbourhood', async () => {
    const { body } = await locations()
    const canada = body.countries.find((c: { code: string }) => c.code === 'CA')
    const vancouver = canada.states.flatMap((s: { cities: Array<{ name: string; areas: Array<{ name: string }> }> }) => s.cities)
      .find((c: { name: string }) => c.name === 'Vancouver')
    expect(vancouver.areas.map((area: { name: string }) => area.name)).not.toContain('UBC')
    expect(vancouver.areas.map((area: { name: string }) => area.name)).toContain('Downtown')
  })

  it('hides a historical UBC area from a database-backed Vancouver picker', async () => {
    mock.findCountries.mockResolvedValue([
      {
        id: 'ca', name: 'Canada', code: 'CA',
        states: [{
          id: 'bc', name: 'British Columbia',
          cities: [{
            id: 'vancouver', name: 'Vancouver',
            areas: [
              { id: 'ubc', name: 'UBC' },
              { id: 'downtown', name: 'Downtown' },
            ],
          }],
        }],
      },
    ])
    const { body } = await locations()
    const canada = body.countries.find((c: { code: string }) => c.code === 'CA')
    const vancouver = canada.states[0].cities[0]
    expect(vancouver.areas.map((area: { name: string }) => area.name)).toEqual(['Downtown'])
  })

  it('keeps all 25 Sri Lankan districts on fallback', async () => {
    mock.findCountries.mockRejectedValue(new Error('Database offline'))
    const { body } = await locations()
    const sriLanka = body.countries.find((c: { code: string }) => c.code === 'LK')
    const districtNames = cities(sriLanka)
    expect(districtNames).toHaveLength(25)
    expect(districtNames).toContain('Badulla')
    expect(districtNames).toContain('Jaffna')
  })

  it('does not re-enable a disabled country during a database outage', async () => {
    mock.getRuntime.mockResolvedValue({ market: { availableMarkets: ['LK'] } })
    mock.findCountries.mockRejectedValue(new Error('Database offline'))
    const { body } = await locations()
    expect(body.countries.map((country: { code: string }) => country.code)).toEqual(['LK'])
  })

  it('does not expose a disabled country with a successful database read', async () => {
    mock.getRuntime.mockResolvedValue({ market: { availableMarkets: ['CA'] } })
    mock.findCountries.mockResolvedValue([
      { id: 'lk', name: 'Sri Lanka', code: 'LK', states: [] },
      { id: 'ca', name: 'Canada', code: 'CA', states: [{ name: 'British Columbia', cities: [{ name: 'Vancouver', areas: [] }] }] },
    ])
    const { body } = await locations()
    expect(body.countries.map((c: { code: string }) => c.code)).toEqual(['CA'])
  })

  it('never exposes countries outside the two launch markets from the DB', async () => {
    mock.findCountries.mockResolvedValue([
      { id: 'us', name: 'United States', code: 'US', states: [{ name: 'New York', cities: [{ name: 'New York', areas: [] }] }] },
      { id: 'ca', name: 'Canada', code: 'CA', states: [{ name: 'Ontario', cities: [{ name: 'Toronto', areas: [] }, { name: 'Vancouver', areas: [] }] }] },
      { id: 'lk', name: 'Sri Lanka', code: 'LK', states: [] },
    ])
    const { body } = await locations()
    expect(body.countries.map((c: { code: string }) => c.code).sort()).toEqual(['CA', 'LK'])
    const canada = body.countries.find((c: { code: string }) => c.code === 'CA')
    expect(cities(canada)).toEqual(['Vancouver'])
  })

  it('fails closed rather than revealing any locations when runtime policy is unavailable', async () => {
    mock.getRuntime.mockRejectedValue(new Error('Market control unavailable'))
    const { response, body } = await locations()
    expect(response.status).toBe(503)
    expect(body).toMatchObject({ source: 'unavailable', countries: [] })
    expect(mock.findCountries).not.toHaveBeenCalled()
  })

  it('empty market configuration never authorizes unsupported countries', async () => {
    mock.getRuntime.mockResolvedValue({ market: { availableMarkets: [] } })
    mock.findCountries.mockResolvedValue([
      { id: 'uk', name: 'United Kingdom', code: 'GB', states: [] },
    ])
    const { body } = await locations()
    expect(body.countries.map((c: { code: string }) => c.code).sort()).toEqual(['CA', 'LK'])
  })
})
