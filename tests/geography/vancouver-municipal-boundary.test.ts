import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  VANCOUVER_BOUNDARY_EDGE_TOLERANCE_METERS,
  VANCOUVER_BOUNDARY_VERSION,
  distanceToVancouverBoundaryMeters,
  evaluateVancouverBoundary,
  getVancouverBoundaryProvenance,
} from '@/lib/geography/vancouver-boundary'
import { resolveMarketFromServiceAddress, resolveJobMarket } from '@/lib/geography/market-engine'

const BOUNDARY_PATH = resolve(
  process.cwd(),
  'lib/geography/data/vancouver-city-boundary.v1.geojson',
)
const boundaryGeoJson = JSON.parse(readFileSync(BOUNDARY_PATH, 'utf8'))
const ring: number[][] = boundaryGeoJson.features[0].geometry.coordinates[0]

const EARTH_RADIUS_METERS = 6371008.8

/** Verified locations (public landmarks / municipality centres). */
const INSIDE_VANCOUVER: Array<[string, number, number]> = [
  ['Vancouver City Hall', 49.2606, -123.1156],
  ['BC Place', 49.2767, -123.1119],
  ['Stanley Park, Lost Lagoon', 49.2943, -123.1479],
  ['Gastown Steamworks', 49.2827, -123.1207],
]

const OUTSIDE_VANCOUVER: Array<[string, number, number]> = [
  ['Metrotown, Burnaby', 49.2596, -122.998],
  ['Richmond Centre', 49.1689, -123.1365],
  ['Vancouver International Airport, Richmond', 49.1967, -123.1815],
  ['Lonsdale, North Vancouver', 49.3106, -123.0824],
  ['Capilano, West Vancouver', 49.3295, -123.137],
  ['New Westminster', 49.2069, -122.911],
  ['Surrey', 49.1045, -122.825],
]

function offsetMeters(
  lat: number,
  lon: number,
  northMeters: number,
  eastMeters: number,
): [number, number] {
  const dLat = northMeters / 111132
  const dLon = eastMeters / (EARTH_RADIUS_METERS * Math.cos((lat * Math.PI) / 180)) * (180 / Math.PI)
  return [lat + dLat, lon + dLon]
}

/**
 * Produces points either side of the official boundary by walking along the
 * local normal of a real boundary vertex. Derived from the official geometry so
 * the edge cases are verified rather than guessed.
 */
function pointsEitherSideOfBoundary(vertexIndex: number, meters: number) {
  const previous = ring[vertexIndex - 1]
  const current = ring[vertexIndex]
  const next = ring[vertexIndex + 1]

  const latRad = (current[1] * Math.PI) / 180
  const metersPerDegLon = (EARTH_RADIUS_METERS * Math.PI) / 180 * Math.cos(latRad)

  // Local metric offset (east, north) of a ring vertex relative to `current`.
  const local = (p: number[]): [number, number] => [
    (p[0] - current[0]) * metersPerDegLon,
    (p[1] - current[1]) * 111132,
  ]

  const [prevEast, prevNorth] = local(previous)
  const [nextEast, nextNorth] = local(next)

  // Tangent along the boundary, then the perpendicular normal.
  const tangentEast = nextEast - prevEast
  const tangentNorth = nextNorth - prevNorth
  const east = -tangentNorth
  const north = tangentEast
  const norm = Math.hypot(east, north) || 1

  const [lat, lon] = offsetMeters(
    current[1],
    current[0],
    (north / norm) * meters,
    (east / norm) * meters,
  )
  return { lat, lon }
}

describe('Vancouver boundary dataset provenance and validity', () => {
  it('records the official source, version and retrieval date', () => {
    const provenance = getVancouverBoundaryProvenance()
    expect(provenance).not.toBeNull()
    expect(provenance?.sourceDatasetId).toBe('city-boundary')
    expect(provenance?.sourceUrl).toContain('opendata.vancouver.ca')
    expect(provenance?.sourceFeatureName).toBe('CITY LINE')
    expect(provenance?.boundaryVersion).toBe(VANCOUVER_BOUNDARY_VERSION)
    expect(provenance?.sourceSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(provenance?.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(provenance?.coordinateOrder).toContain('longitude, latitude')
  })

  it('is a valid closed counterclockwise [lon, lat] ring', () => {
    expect(boundaryGeoJson.features[0].geometry.type).toBe('Polygon')
    expect(ring.length).toBeGreaterThan(100)
    expect(ring[0][0]).toBe(ring[ring.length - 1][0])
    expect(ring[0][1]).toBe(ring[ring.length - 1][1])

    // Longitude first (west coast values), latitude second (Vancouver values).
    for (const [lon, lat] of ring) {
      expect(lon).toBeGreaterThan(-124)
      expect(lon).toBeLessThan(-122)
      expect(lat).toBeGreaterThan(49)
      expect(lat).toBeLessThan(50)
    }

    // Signed area must be positive for a counterclockwise ring (RFC 7946).
    let area = 0
    for (let i = 0; i < ring.length - 1; i += 1) {
      area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    }
    expect(area / 2).toBeGreaterThan(0)
  })
})

describe('Vancouver municipal containment', () => {
  it.each(INSIDE_VANCOUVER)('accepts %s', (_name, lat, lon) => {
    expect(evaluateVancouverBoundary(lat, lon)).toBe('INSIDE')
  })

  it.each(OUTSIDE_VANCOUVER)('rejects %s', (_name, lat, lon) => {
    expect(evaluateVancouverBoundary(lat, lon)).toBe('OUTSIDE')
  })

  it('treats points on both sides of a real boundary vertex as requiring verification', () => {
    // The municipal shoreline is highly convoluted (inlets, Stanley Park), so
    // every sampled vertex must fall inside the verification band at ±40 m.
    for (const vertexIndex of [20, 120, 260, 400]) {
      for (const step of [40, -40]) {
        const { lat, lon } = pointsEitherSideOfBoundary(vertexIndex, step)
        expect(evaluateVancouverBoundary(lat, lon)).toBe('NEAR_BOUNDARY')
      }
    }
  })

  it('keeps the edge band narrow enough that the city interior resolves definitively', () => {
    let resolvedVertices = 0
    for (const vertexIndex of [20, 120, 260, 400, 60, 300]) {
      for (let step = 200; step <= 3000; step += 200) {
        const { lat, lon } = pointsEitherSideOfBoundary(vertexIndex, step)
        if (evaluateVancouverBoundary(lat, lon) !== 'NEAR_BOUNDARY') {
          resolvedVertices += 1
          break
        }
      }
    }
    expect(resolvedVertices).toBeGreaterThanOrEqual(4)
  })

  it('reports a plausible distance to the boundary', () => {
    const far = distanceToVancouverBoundaryMeters(49.2606, -123.1156)
    expect(far).not.toBeNull()
    expect(far as number).toBeGreaterThan(1000)
    expect(far as number).toBeLessThan(10000)
    expect(VANCOUVER_BOUNDARY_EDGE_TOLERANCE_METERS).toBe(100)
  })

  it('rejects invalid and missing coordinates', () => {
    expect(evaluateVancouverBoundary(Number.NaN, -123.1)).toBe('INVALID_COORDINATES')
    expect(evaluateVancouverBoundary(49.2, Number.POSITIVE_INFINITY)).toBe('INVALID_COORDINATES')
    expect(evaluateVancouverBoundary(200, -123.1)).toBe('INVALID_COORDINATES')
    expect(evaluateVancouverBoundary(49.2, -400)).toBe('INVALID_COORDINATES')
    expect(evaluateVancouverBoundary(null, undefined)).toBe('INVALID_COORDINATES')
    expect(evaluateVancouverBoundary('49.26', '-123.11')).toBe('INVALID_COORDINATES')
  })
})

describe('market resolution uses the municipal boundary', () => {
  it('grants Vancouver only inside the official boundary and records the version', () => {
    const result = resolveMarketFromServiceAddress({ latitude: 49.2767, longitude: -123.1119 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.countryCode).toBe('CA')
      expect(result.boundaryVersion).toBe(VANCOUVER_BOUNDARY_VERSION)
    }
  })

  it('rejects neighbouring municipalities with a clear reason', () => {
    for (const [, lat, lon] of OUTSIDE_VANCOUVER) {
      const result = resolveMarketFromServiceAddress({ latitude: lat, longitude: lon })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(['ADDRESS_OUTSIDE_VANCOUVER', 'ADDRESS_OUTSIDE_LAUNCH_GEOGRAPHY']).toContain(
          result.code,
        )
        expect(result.error).toMatch(/Vancouver|supported launch areas/)
      }
    }
  })

  it('requires verification instead of silently granting service near the border', () => {
    const edge = pointsEitherSideOfBoundary(260, 25)
    const result = resolveMarketFromServiceAddress({ latitude: edge.lat, longitude: edge.lon })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('ADDRESS_REQUIRES_VERIFICATION')
      expect(result.error).toMatch(/verification/)
    }
  })

  it('never falls back to Sri Lanka when a Canadian address is rejected', () => {
    const burnaby = resolveMarketFromServiceAddress({ latitude: 49.2596, longitude: -122.998 })
    expect(burnaby.ok).toBe(false)
    if (!burnaby.ok) expect(burnaby.error).not.toMatch(/Sri Lanka/)
  })

  it('ignores a modified Canadian flag on a Sri Lankan address', () => {
    const result = resolveMarketFromServiceAddress({
      latitude: 6.9271,
      longitude: 79.8612,
      claimedCountryCode: 'CA',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.countryCode).toBe('LK')
      expect(result.boundaryVersion).toBeNull()
    }
  })

  it('ignores a modified Sri Lankan flag on a Vancouver address', () => {
    const result = resolveMarketFromServiceAddress({
      latitude: 49.2767,
      longitude: -123.1119,
      claimedCountryCode: 'LK',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('rejects a Canadian postal code submitted for a Vancouver coordinate mismatch', () => {
    // Colombo coordinates with a Canadian postal code must fail closed.
    const mismatch = resolveMarketFromServiceAddress({
      latitude: 6.9271,
      longitude: 79.8612,
      postalCode: 'V6B 1A1',
    })
    expect(mismatch.ok).toBe(false)
    if (!mismatch.ok) expect(mismatch.code).toBe('POSTAL_CODE_INVALID')
  })

  it('fails closed when a Vancouver address has no validated coordinates', () => {
    const noCoordinates = resolveMarketFromServiceAddress({ postalCode: 'V6B 1A1' })
    expect(noCoordinates.ok).toBe(false)
    if (!noCoordinates.ok) expect(noCoordinates.code).toBe('ADDRESS_REQUIRES_VERIFICATION')

    const missing = resolveMarketFromServiceAddress({})
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.code).toBe('ADDRESS_NOT_PROVIDED')
  })

  it('rejects a stored job whose coordinates sit outside Vancouver', () => {
    expect(resolveJobMarket({ countryCode: 'CA', latitude: 49.2596, longitude: -122.998 })).toBeNull()
    expect(resolveJobMarket({ countryCode: 'CA', latitude: 49.2767, longitude: -123.1119 })).toBe('CA')
  })
})