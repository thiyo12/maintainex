import { headers } from 'next/headers'
import { getRegionFromHost, REGIONS } from '@/lib/regions'
import { localBusinessSchema, breadcrumbSchema } from '@/lib/seo'
import type { Metadata } from 'next'
import ServicesPage from '../client'

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('host') || ''
  const regionKey = getRegionFromHost(host)
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  return {
    title: 'Services in Colombo | Home Cleaning & Maintenance Services Colombo | Maintainex',
    description: 'Book professional home cleaning, plumbing, electrical & AC services in Colombo. Trusted service providers, free quotes, same-day booking. Vetted professionals in Colombo.',
    keywords: 'services in Colombo, home cleaning Colombo, Colombo service providers, plumbing Colombo, electrical services Colombo, AC repair Colombo, Maintainex Colombo',
    alternates: { canonical: `${baseUrl}/services/colombo` },
    openGraph: {
      title: 'Services in Colombo | Maintainex Sri Lanka',
      description: 'Professional home services in Colombo. Book cleaning, plumbing, electrical & more. Free quotes, vetted pros.',
      url: `${baseUrl}/services/colombo`,
    },
  }
}

export default async function ColomboPage() {
  const host = (await headers()).get('host') || ''
  const regionKey = getRegionFromHost(host)
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  const country = REGIONS[regionKey].countryName

  const cityJson = localBusinessSchema(regionKey, 'Colombo')
  const breadcrumbJson = breadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: country, url: baseUrl },
    { name: 'Colombo', url: `${baseUrl}/services/colombo` },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <ServicesPage cityName="Colombo" />
    </>
  )
}
