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
    title: 'Services in Mississauga | Home Cleaning & Maintenance Services Mississauga | Maintainex Canada',
    description: 'Book professional home cleaning, plumbing, electrical & AC services in Mississauga. Trusted service providers, free quotes, same-day booking. Vetted professionals in Mississauga & GTA.',
    keywords: 'services in Mississauga, home cleaning Mississauga, Mississauga service providers, plumbing Mississauga, electrical services Mississauga, AC repair Mississauga, Maintainex Canada',
    alternates: { canonical: `${baseUrl}/services/mississauga` },
    openGraph: {
      title: 'Services in Mississauga | Maintainex Canada',
      description: 'Professional home services in Mississauga. Book cleaning, plumbing, electrical & more. Free quotes, vetted pros.',
      url: `${baseUrl}/services/mississauga`,
    },
  }
}

export default async function MississaugaPage() {
  const host = (await headers()).get('host') || ''
  const regionKey = getRegionFromHost(host)
  const baseUrl = 'https://ca.maintainex.lk'
  const country = REGIONS[regionKey].countryName

  const cityJson = localBusinessSchema(regionKey, 'Mississauga')
  const breadcrumbJson = breadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: country, url: baseUrl },
    { name: 'Mississauga', url: `${baseUrl}/services/mississauga` },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <ServicesPage cityName="Mississauga" />
    </>
  )
}
