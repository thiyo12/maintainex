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
    title: 'Services in Galle | Home Cleaning & Maintenance Services Galle | Maintainex',
    description: 'Book professional home cleaning, plumbing, electrical & AC services in Galle. Trusted service providers, free quotes, same-day booking. Vetted professionals in Galle.',
    keywords: 'services in Galle, home cleaning Galle, Galle service providers, plumbing Galle, electrical services Galle, AC repair Galle, Maintainex Galle',
    alternates: { canonical: `${baseUrl}/services/galle` },
    openGraph: {
      title: 'Services in Galle | Maintainex Sri Lanka',
      description: 'Professional home services in Galle. Book cleaning, plumbing, electrical & more. Free quotes, vetted pros.',
      url: `${baseUrl}/services/galle`,
    },
  }
}

export default async function GallePage() {
  const host = (await headers()).get('host') || ''
  const regionKey = getRegionFromHost(host)
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  const country = REGIONS[regionKey].countryName

  const cityJson = localBusinessSchema(regionKey, 'Galle')
  const breadcrumbJson = breadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: country, url: baseUrl },
    { name: 'Galle', url: `${baseUrl}/services/galle` },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <ServicesPage cityName="Galle" />
    </>
  )
}
