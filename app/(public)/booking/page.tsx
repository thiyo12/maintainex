import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import type { Metadata } from 'next'
import BookingPage from './client'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const c = REGIONS[getRegionFromHost(host)].countryName
  return {
    title: 'Book a Service',
    description: `Book professional cleaning and home maintenance services in ${c} online. Free quotes, trusted professionals, and same-day service available.`,
    openGraph: {
      title: `Book a Service | Maintainex ${c}`,
      description: `Schedule professional cleaning services in ${c} online. Easy booking, free quotes.`,
    },
  }
}

export default function BookingPageWrapper() {
  return <BookingPage />
}
