import { request } from './client'
import { SearchResult } from '../lib/types'

export const search = {
  all: (query: string) =>
    request<SearchResult>(`/api/mobile/search?q=${encodeURIComponent(query)}`),
}
