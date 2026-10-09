import { v2Request } from './v2-client'

export const v2Search = {
  categories: (q: string, lang?: string, countryCode?: string) =>
    v2Request<{
      query: string; lang: string; correctedQuery?: string;
      categories: { id: string; name: string; icon: string; colorHex: string; score: number; correctedQuery?: string }[];
      subServices: { id: string; name: string; categoryId: string; categoryName: string; categoryIcon: string; categoryColor: string; score: number }[];
      totalResults: number;
    }>(
      `/api/mobile/v2/search?q=${encodeURIComponent(q)}${lang ? `&lang=${lang}` : ''}${countryCode ? `&country=${encodeURIComponent(countryCode)}` : ''}`
    ),
  popular: (countryCode?: string) =>
    v2Request<{ results: { query: string; count: number }[] }>(
      `/api/mobile/v2/search?popular=true${countryCode ? `&country=${encodeURIComponent(countryCode)}` : ''}`
    ),
}
