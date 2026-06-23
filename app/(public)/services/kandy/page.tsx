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
    title: 'Services in Kandy | Home Cleaning & Maintenance Services Kandy | Maintainex',
    description: 'Book professional home cleaning, plumbing, electrical & AC services in Kandy. Trusted service providers, free quotes, same-day booking. Vetted professionals in Kandy.',
    keywords: 'services in Kandy, home cleaning Kandy, Kandy service providers, plumbing Kandy, electrical services Kandy, AC repair Kandy, Maintainex Kandy',
    alternates: { canonical: `${baseUrl}/services/kandy` },
    openGraph: {
      title: 'Services in Kandy | Maintainex Sri Lanka',
      description: 'Professional home services in Kandy. Book cleaning, plumbing, electrical & more. Free quotes, vetted pros.',
      url: `${baseUrl}/services/kandy`,
    },
  }
}

export default async function KandyPage() {
  const host = (await headers()).get('host') || ''
  const regionKey = getRegionFromHost(host)
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  const country = REGIONS[regionKey].countryName

  const cityJson = localBusinessSchema(regionKey, 'Kandy')
  const breadcrumbJson = breadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: country, url: baseUrl },
    { name: 'Kandy', url: `${baseUrl}/services/kandy` },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <ServicesPage cityName="Kandy" />
    </>
  )
}
