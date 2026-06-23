import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import type { Metadata } from 'next'
import ContactPage from './client'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const c = REGIONS[regionKey].countryName
  const baseUrl = regionKey === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  return {
    title: 'Contact Us',
    description: `Get in touch with Maintainex ${c}. Call, email, or visit our Jaffna headquarters. We're here to help with all your cleaning and home service needs.`,
    alternates: { canonical: `${baseUrl}/contact` },
    openGraph: {
      title: `Contact Maintainex ${c}`,
      description: `Reach out to Maintainex ${c} for inquiries, bookings, or support.`,
    },
  }
}

export default function ContactPageWrapper() {
  return <ContactPage />
}
