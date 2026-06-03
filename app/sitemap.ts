import { REGIONS, getRegionFromHost } from '@/lib/regions'
import { slugifyCity } from '@/lib/cities'
import { headers } from 'next/headers'
import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

const STATIC_PATHS = ['/', '/services', '/about', '/contact', '/booking', '/careers']
const FALLBACK_SLUGS = ['cleaning', 'plumbing', 'electrical', 'painting', 'roofing', 'hvac', 'appliance-repair', 'carpentry', 'landscaping', 'pest-control', 'moving', 'handyman', 'deep-cleaning', 'carpet-cleaning', 'window-cleaning', 'office-cleaning', 'disinfection', 'construction']

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

  let slugs: string[] = FALLBACK_SLUGS

  try {
    const { prisma } = await import('@/lib/prisma')
    const services = await prisma.service.findMany({
      where: { isActive: true, slug: { not: null } },
      select: { slug: true },
    })
    const dbSlugs = services.map(s => s.slug).filter(Boolean) as string[]
    if (dbSlugs.length > 0) slugs = dbSlugs
  } catch (e) {
    // DB unavailable — use fallback slugs
  }

  const districts = REGIONS[region]?.districts || []

  for (const slug of slugs) {
    entries.push({
      url: `${baseUrl}/services/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })

    for (const district of districts) {
      const citySlug = slugifyCity(district)
      entries.push({
        url: `${baseUrl}/services/${slug}/${citySlug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })
    }
  }

  return entries
}
