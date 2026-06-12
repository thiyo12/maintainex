/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://maintainex.lk',
  generateRobotsTxt: false,
  outDir: 'public',
  exclude: ['/admin/*', '/api/*', '/booking/confirmation', '/maintenance'],
  alternateRefs: [
    {
      href: 'https://maintainex.lk',
      hreflang: 'x-default',
    },
    {
      href: 'https://maintainex.lk',
      hreflang: 'en-LK',
    },
    {
      href: 'https://ca.maintainex.lk',
      hreflang: 'en-CA',
    },
  ],
  transform: async (config, path) => {
    return {
      loc: path,
      changefreq: path === '/' ? 'daily' : 'weekly',
      priority: path === '/' ? 1.0 : 0.8,
      lastmod: new Date().toISOString(),
      alternateRefs: config.alternateRefs ?? [],
    }
  },
}
