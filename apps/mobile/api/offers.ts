import { request } from './client'

export const seasonalOffers = {
  list: (country: string, season?: string) =>
    request<import('../lib/seasonal').SeasonalOffer[]>(`/api/mobile/seasonal-offers?country=${country}${season ? `&season=${season}` : ''}`),
}

export const serviceCategories = {
  list: (country?: string) =>
    request<{ id: string; name: string; jobs: { id: string; name: string }[] }[]>(`/api/mobile/service-categories${country ? `?country=${country}` : ''}`),
}
