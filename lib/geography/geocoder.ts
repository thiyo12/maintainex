export type ReverseGeocodeResult =
  | { ok: true; countryCode: 'LK' | 'CA'; locality: string | null; district: string | null }
  | { ok: false; code: 'GEOCODER_NOT_CONFIGURED' | 'GEOCODER_UNAVAILABLE' | 'ADDRESS_NOT_VERIFIED' }

type Fetcher = typeof fetch

/** Server-side Google reverse geocoding. The key must never be NEXT_PUBLIC. */
export async function verifyServiceCoordinates(
  latitude: number,
  longitude: number,
  options: { apiKey?: string; fetcher?: Fetcher } = {},
): Promise<ReverseGeocodeResult> {
  const apiKey = options.apiKey ?? process.env.GOOGLE_MAPS_GEOCODING_API_KEY
  if (!apiKey) return { ok: false, code: 'GEOCODER_NOT_CONFIGURED' }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, code: 'ADDRESS_NOT_VERIFIED' }
  }

  const endpoint = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  endpoint.searchParams.set('latlng', `${latitude},${longitude}`)
  endpoint.searchParams.set('key', apiKey)
  const fetcher = options.fetcher ?? fetch
  let payload: any
  try {
    const response = await fetcher(endpoint, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return { ok: false, code: 'GEOCODER_UNAVAILABLE' }
    payload = await response.json()
  } catch {
    return { ok: false, code: 'GEOCODER_UNAVAILABLE' }
  }
  if (payload?.status !== 'OK' || !Array.isArray(payload.results)) {
    return { ok: false, code: payload?.status === 'ZERO_RESULTS' ? 'ADDRESS_NOT_VERIFIED' : 'GEOCODER_UNAVAILABLE' }
  }

  const components = payload.results.flatMap((result: any) =>
    Array.isArray(result?.address_components) ? result.address_components : [])
  const country = components.find((component: any) => component?.types?.includes('country'))?.short_name
  const locality = components.find((component: any) =>
    component?.types?.includes('locality') || component?.types?.includes('postal_town'))?.long_name ?? null
  const district = components.find((component: any) =>
    component?.types?.includes('administrative_area_level_2'))?.long_name ?? null
  if (country !== 'LK' && country !== 'CA') return { ok: false, code: 'ADDRESS_NOT_VERIFIED' }
  return { ok: true, countryCode: country, locality, district }
}
