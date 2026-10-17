/**
 * Market-safe company profile declarations (Phase 04).
 *
 * A declared service area is NOT a geocoded location or authorization for a
 * job. The authoritative job-address market engine remains the booking gate.
 */
export type NormalizedCompanyAreas =
  | { ok: true; areas: string[] }
  | { ok: false; error: string }

export function normalizeCompanyServiceAreas(
  market: string,
  value: unknown,
): NormalizedCompanyAreas {
  if (market !== 'LK' && market !== 'CA') {
    return { ok: false, error: 'Company market is not supported' }
  }
  if (!Array.isArray(value) || value.length > 25 ||
      value.some(area => typeof area !== 'string' || area.trim().length === 0 || area.trim().length > 100)) {
    return { ok: false, error: 'Service areas must be a list of nonempty area names' }
  }

  const areas = [...new Set(value.map((area: string) => area.trim()))]
  if (market === 'CA') {
    // Only the City of Vancouver municipality is enabled. "Vancouver" plus
    // another municipality must NEVER slip through by satisfying "includes".
    if (areas.length !== 1 || areas[0].toLowerCase() !== 'vancouver') {
      return { ok: false, error: 'Declare City of Vancouver only as your company service area' }
    }
    return { ok: true, areas: ['Vancouver'] }
  }

  // LK providers may retain existing locally named service areas, including
  // legacy town labels. District eligibility is checked by the actual service
  // address and matching engine, never by this freeform display metadata.
  return { ok: true, areas }
}

export type NormalizedCompanyServices =
  | { ok: true; services: string[] }
  | { ok: false; error: string }

export function normalizeCompanyServices(value: unknown): NormalizedCompanyServices {
  if (!Array.isArray(value) || value.length === 0 || value.length > 150 ||
      value.some(service => typeof service !== 'string' ||
        service.trim().length === 0 || service.trim().length > 150)) {
    return { ok: false, error: 'Select at least one valid company service' }
  }
  const services = [...new Set(value.map((service: string) => service.trim()))]
  return { ok: true, services }
}
