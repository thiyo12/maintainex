import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/booking/confirmation', '/maintenance'],
      },
    ],
    sitemap: [
      'https://maintainex.lk/sitemap.xml',
      'https://ca.maintainex.lk/sitemap.xml',
    ],
  }
}
