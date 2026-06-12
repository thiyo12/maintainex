import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import type { Metadata } from 'next'
import CareersPage from './client'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const c = REGIONS[getRegionFromHost(host)].countryName
  return {
    title: 'Careers',
    description: `Join Maintainex ${c}. Explore career opportunities, competitive benefits, and grow with ${c === 'Sri Lanka' ? 'Sri Lanka' : "Canada's"} leading cleaning service provider.`,
    openGraph: {
      title: `Careers at Maintainex ${c}`,
      description: `Build your career with Maintainex ${c}. We offer great benefits, training, and growth.`,
    },
  }
}

export default function CareersPageWrapper() {
  return <CareersPage />
}
