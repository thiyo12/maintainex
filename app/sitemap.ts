import { REGIONS, getRegionFromHost } from '@/lib/regions'
import { slugifyCity } from '@/lib/cities'
import { headers } from 'next/headers'
import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

const STATIC_PATHS = ['/', '/services', '/about', '/contact', '/booking', '/careers']

const ALL_SERVICE_SLUGS = [
  'cleaning', 'plumbing', 'electrical', 'painting', 'roofing', 'hvac',
  'appliance-repair', 'carpentry', 'landscaping', 'pest-control', 'moving',
  'handyman', 'deep-cleaning', 'carpet-cleaning', 'window-cleaning',
  'office-cleaning', 'disinfection', 'construction',
]

const CITY_PAGES: Record<string, string[]> = {
  LK: ['colombo', 'kandy', 'galle', 'jaffna'],
  CA: ['toronto', 'mississauga'],
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const region = getRegionFromHost(host)
  const baseUrl = region === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(path => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'daily' as const : 'weekly' as const,
    priority: path === '/' ? 1.0 : 0.8,
  }))

  const districts = REGIONS[region]?.districts || []

  for (const slug of ALL_SERVICE_SLUGS) {
    entries.push({
      url: `${baseUrl}/services/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })

    for (const district of districts) {
      const citySlug = slugifyCity(district)
      const isJaffna = district === 'Jaffna'
      entries.push({
        url: `${baseUrl}/services/${slug}/${citySlug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: isJaffna ? 0.85 : 0.6,
      })
    }
  }

  for (const citySlug of CITY_PAGES[region] || []) {
    const isJaffna = citySlug === 'jaffna'
    entries.push({
      url: `${baseUrl}/services/${citySlug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: isJaffna ? 0.9 : 0.7,
    })
  }

  return entries
}
