import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const c = REGIONS[getRegionFromHost(host)].countryName
  return {
    title: 'Services',
    description: `Browse our professional cleaning and home maintenance services in ${c}. Book online with Maintainex ${c} today.`,
    openGraph: { title: `Services | Maintainex ${c}`, description: `Professional services in ${c}.` },
  }
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
