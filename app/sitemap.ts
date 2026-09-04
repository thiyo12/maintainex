import { headers } from 'next/headers'
import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'

const STATIC_PATHS = ['/', '/about', '/contact', '/booking', '/services', '/careers', '/vision', '/waitlist']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const region = host.includes('ca.') ? 'CA' : 'LK'
  const baseUrl = region === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(path => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'daily' as const : 'weekly' as const,
    priority: path === '/' ? 1.0 : 0.8,
  }))

  return entries
}
