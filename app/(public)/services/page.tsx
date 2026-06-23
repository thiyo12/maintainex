import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import type { Metadata } from 'next'
import ServicesPage from './client'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const c = REGIONS[regionKey].countryName
  const baseUrl = regionKey === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  return {
    title: 'Services',
    description: `Browse all professional cleaning and home maintenance services from Maintainex ${c}. Home cleaning, office cleaning, deep cleaning, pest control & more.`,
    alternates: { canonical: `${baseUrl}/services` },
    openGraph: {
      title: `Our Services | Maintainex ${c}`,
      description: `Professional cleaning and home services in ${c}. Book online today.`,
    },
  }
}

export default function ServicesPageWrapper() {
  return <ServicesPage />
}
