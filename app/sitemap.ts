import { prisma } from '@/lib/prisma'
import { REGIONS } from '@/lib/regions'
import { slugifyCity } from '@/lib/cities'

const BASE_URLS = {
  LK: 'https://maintainex.lk',
  CA: 'https://ca.maintainex.lk',
}

const STATIC_PATHS = ['/', '/services', '/about', '/contact', '/booking', '/careers']

export default async function sitemap() {
  const entries = []

  for (const [region, baseUrl] of Object.entries(BASE_URLS)) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: `${baseUrl}${path}`,
        lastModified: new Date(),
        changeFrequency: path === '/' ? 'daily' as const : 'weekly' as const,
        priority: path === '/' ? 1.0 : 0.8,
      })
    }

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
  }

  return entries
}
