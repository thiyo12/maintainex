/**
 * City of Vancouver municipal boundary (Phase 02).
 *
 * The boundary is the official City of Vancouver "city-boundary" dataset
 * (`CITY LINE` MultiLineString) converted to a polygon. It is the final authority
 * for Canadian market identity: a service location is in the Vancouver market
 * only when it falls inside this polygon.
 *
 * Provenance is recorded on the GeoJSON feature itself, so the version, source
 * URL and retrieval date travel with the data.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point, polygon as turfPolygon } from '@turf/helpers'

export const VANCOUVER_BOUNDARY_VERSION = 'v1'

const BOUNDARY_FILE = resolve(
  process.cwd(),
  'lib/geography/data/vancouver-city-boundary.v1.geojson',
)

/**
 * Points within this distance of the municipal boundary are treated as
 * ambiguous and require human verification instead of an automatic decision.
 */
export const VANCOUVER_BOUNDARY_EDGE_TOLERANCE_METERS = 100

export interface BoundaryProvenance {
  name?: string
  source?: string
  sourceDatasetId?: string
  sourceUrl?: string
  sourceExportUrl?: string
  sourceFeatureName?: string
  sourceSha256?: string
  boundaryVersion?: string
  retrievedAt?: string
  coordinateOrder?: string
  conversion?: string
  license?: string
}

interface LoadedBoundary {
  polygon: ReturnType<typeof turfPolygon>
  provenance: BoundaryProvenance
}

let cached: LoadedBoundary | null = null

/**
 * Loads the versioned boundary from the repository. This never reaches the
 * network: the checked-in copy is the validated local fallback required when the
 * open data portal is unavailable.
 */
function loadBoundary(): LoadedBoundary {
  if (cached) return cached

  const raw = JSON.parse(readFileSync(BOUNDARY_FILE, 'utf8'))
  const feature = raw?.features?.[0]
  const geometry = feature?.geometry

  if (!geometry || geometry.type !== 'Polygon') {
    throw new Error(
      `Vancouver boundary dataset is unusable (expected Polygon, found ${geometry?.type ?? 'nothing'}).`,
    )
  }

  // RFC 7946: exterior ring closed, counterclockwise, [lon, lat] order.
  const ring = geometry.coordinates?.[0]
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new Error('Vancouver boundary dataset has an invalid exterior ring.')
  }
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new Error('Vancouver boundary exterior ring is not closed.')
  }

  cached = {
    polygon: turfPolygon(geometry.coordinates),
    provenance: (feature.properties || {}) as BoundaryProvenance,
  }
  return cached
}

export function getVancouverBoundaryProvenance(): BoundaryProvenance | null {
  try {
    return loadBoundary().provenance
  } catch {
    return null
  }
}

const METERS_PER_DEGREE_LAT = 111132
const EARTH_RADIUS_METERS = 6371008.8

function projectToLocalMeters(
  latitude: number,
  longitude: number,
  originLat: number,
  originLon: number,
): [number, number] {
  const x =
    EARTH_RADIUS_METERS *
    Math.cos((originLat * Math.PI) / 180) *
    ((longitude - originLon) * Math.PI) / 180
  const y = EARTH_RADIUS_METERS * ((latitude - originLat) * Math.PI) / 180
  return [x, y]
}

function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/**
 * Shortest distance in meters from a point to the municipal boundary.
 * Used to detect addresses that sit on a municipal border.
 */
export function distanceToVancouverBoundaryMeters(
  latitude: number,
  longitude: number,
): number | null {
  let boundary: LoadedBoundary
  try {
    boundary = loadBoundary()
  } catch {
    return null
  }

  const ring = boundary.polygon.geometry.coordinates[0]
  let originLat = 0
  let originLon = 0
  for (const [lon, lat] of ring) {
    originLat += lat
    originLon += lon
  }
  originLat /= ring.length
  originLon /= ring.length

  const [px, py] = projectToLocalMeters(latitude, longitude, originLat, originLon)
  let min = Number.POSITIVE_INFINITY
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [ax, ay] = projectToLocalMeters(ring[i][1], ring[i][0], originLat, originLon)
    const [bx, by] = projectToLocalMeters(ring[i + 1][1], ring[i + 1][0], originLat, originLon)
    const d = segmentDistance(px, py, ax, ay, bx, by)
    if (d < min) min = d
  }
  return min === Number.POSITIVE_INFINITY ? null : min
}

export type VancouverBoundaryStatus =
  | 'INSIDE'
  | 'OUTSIDE'
  | 'NEAR_BOUNDARY'
  | 'DATASET_UNAVAILABLE'
  | 'INVALID_COORDINATES'

/**
 * Final municipal containment decision for a Canadian service location.
 *
 * - INSIDE           → inside the official municipality
 * - OUTSIDE          → proven outside Vancouver
 * - NEAR_BOUNDARY    → within the edge tolerance; requires verification
 * - DATASET_UNAVAILABLE / INVALID_COORDINATES → must fail closed upstream
 */
export function evaluateVancouverBoundary(
  latitude: unknown,
  longitude: unknown,
): VancouverBoundaryStatus {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return 'INVALID_COORDINATES'
  }

  let boundary: LoadedBoundary
  try {
    boundary = loadBoundary()
  } catch {
    return 'DATASET_UNAVAILABLE'
  }

  const inside = booleanPointInPolygon(
    point([longitude, latitude]),
    boundary.polygon,
  )

  const distance = distanceToVancouverBoundaryMeters(latitude, longitude)
  if (distance !== null && distance <= VANCOUVER_BOUNDARY_EDGE_TOLERANCE_METERS) {
    return 'NEAR_BOUNDARY'
  }

  return inside ? 'INSIDE' : 'OUTSIDE'
}

export { METERS_PER_DEGREE_LAT }
