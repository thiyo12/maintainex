import { headers } from 'next/headers'
import { getRegionFromHost, REGIONS } from '@/lib/regions'
import { localBusinessSchema, breadcrumbSchema } from '@/lib/seo'
import type { Metadata } from 'next'
import ServicesPage from '../client'

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('host') || ''
  const regionKey = getRegionFromHost(host)
  const baseUrl = 'https://ca.maintainex.lk'
  const isCA = regionKey === 'CA'

  return {
    title: 'Services in Toronto | Home Cleaning & Maintenance Services Toronto | Maintainex Canada',
    description: 'Book professional home cleaning, plumbing, electrical & AC services in Toronto. Trusted service providers, free quotes, same-day booking. Vetted professionals in Toronto & GTA.',
    keywords: 'services in Toronto, home cleaning Toronto, Toronto service providers, plumbing Toronto, electrical services Toronto, AC repair Toronto, Maintainex Canada',
    alternates: { canonical: `${baseUrl}/services/toronto` },
    openGraph: {
      title: 'Services in Toronto | Maintainex Canada',
      description: 'Professional home services in Toronto. Book cleaning, plumbing, electrical & more. Free quotes, vetted pros.',
      url: `${baseUrl}/services/toronto`,
    },
  }
}

export default async function TorontoPage() {
  const host = (await headers()).get('host') || ''
  const regionKey = getRegionFromHost(host)
  const baseUrl = 'https://ca.maintainex.lk'
  const country = REGIONS[regionKey].countryName

  const cityJson = localBusinessSchema(regionKey, 'Toronto')
  const breadcrumbJson = breadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: country, url: baseUrl },
    { name: 'Toronto', url: `${baseUrl}/services/toronto` },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <ServicesPage cityName="Toronto" />
    </>
  )
}
