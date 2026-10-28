import { v2Search } from '../api/v2-search'

export type DiscoverySearchData = Awaited<ReturnType<typeof v2Search.categories>>

export interface DiscoverySearchState {
  categories: DiscoverySearchData['categories']
  services: DiscoverySearchData['subServices']
  correctedQuery?: string
  failed: boolean
}

export async function loadDiscoverySearch(
  query: string,
  countryCode?: string,
  request: typeof v2Search.categories = v2Search.categories,
): Promise<DiscoverySearchState> {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) {
    return { categories: [], services: [], correctedQuery: undefined, failed: false }
  }

  try {
    const data = await request(normalizedQuery, undefined, countryCode)
    return {
      categories: (data.categories || []).slice(0, 4),
      services: (data.subServices || []).slice(0, 5),
      correctedQuery: data.correctedQuery,
      failed: false,
    }
  } catch {
    return { categories: [], services: [], correctedQuery: undefined, failed: true }
  }
}
