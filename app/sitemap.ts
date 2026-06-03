import { prisma } from '@/lib/prisma'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import { slugifyCity } from '@/lib/cities'
import { headers } from 'next/headers'
import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

const STATIC_PATHS = ['/', '/services', '/about', '/contact', '/booking', '/careers']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const region = getRegionFromHost(host)
  const isCA = region === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(path => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'daily' as const : 'weekly' as const,
    priority: path === '/' ? 1.0 : 0.8,
  }))

  const services = await prisma.service.findMany({
    where: { isActive: true },
    select: { slug: true, createdAt: true },
  })

  for (const service of services) {
    if (!service.slug) continue

    entries.push({
      url: `${baseUrl}/services/${service.slug}`,
      lastModified: service.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })

    const districts = REGIONS[region]?.districts || []
    for (const district of districts) {
      const citySlug = slugifyCity(district)
      entries.push({
        url: `${baseUrl}/services/${service.slug}/${citySlug}`,
        lastModified: service.createdAt,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })
    }
  }

  return entries
}
