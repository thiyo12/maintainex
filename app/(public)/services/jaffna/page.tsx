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
    title: 'Services in Jaffna | Home Cleaning & Maintenance Services Jaffna | Maintainex',
    description: 'Book professional home cleaning, plumbing, electrical & AC services in Jaffna. Trusted service providers, free quotes, same-day booking. Vetted professionals in Jaffna.',
    keywords: 'services in Jaffna, home cleaning Jaffna, Jaffna service providers, plumbing Jaffna, electrical services Jaffna, AC repair Jaffna, Maintainex Jaffna',
    alternates: { canonical: `${baseUrl}/services/jaffna` },
    openGraph: {
      title: 'Services in Jaffna | Maintainex Sri Lanka',
      description: 'Professional home services in Jaffna. Book cleaning, plumbing, electrical & more. Free quotes, vetted pros.',
      url: `${baseUrl}/services/jaffna`,
    },
  }
}

export default async function JaffnaPage() {
  const host = (await headers()).get('host') || ''
  const regionKey = getRegionFromHost(host)
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  const country = REGIONS[regionKey].countryName

  const cityJson = localBusinessSchema(regionKey, 'Jaffna')
  const breadcrumbJson = breadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: country, url: baseUrl },
    { name: 'Jaffna', url: `${baseUrl}/services/jaffna` },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <ServicesPage cityName="Jaffna" />
    </>
  )
}
