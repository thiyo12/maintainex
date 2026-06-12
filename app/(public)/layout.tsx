import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const c = REGIONS[getRegionFromHost(host)].countryName
  return {
    description: `Browse professional cleaning and home maintenance services in ${c}. Book online with Maintainex ${c} today.`,
    openGraph: { description: `Professional home services in ${c}.` },
  }
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
