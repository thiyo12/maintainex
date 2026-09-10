import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import Client from './(public)/home/client'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const c = REGIONS[regionKey].countryName
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  return {
    title: `MaintainEX — Connect with Professionals Who Get the Job Done in ${c}`,
    description: `Connect with verified professionals for any task — home, business, or local in ${c}. 10% platform fee. AI-powered matching.`,
    keywords: isCA
      ? `task marketplace Canada, hire tasker Toronto, local services Ontario, cleaning help Toronto, handyman Canada`
      : `task marketplace Sri Lanka, hire tasker Colombo, local services Sri Lanka, cleaning help Colombo, handyman Sri Lanka`,
    alternates: { canonical: '/', languages: { 'en-LK': 'https://maintainex.lk', 'en-CA': 'https://ca.maintainex.lk' } },
    openGraph: {
      title: `MaintainEX — Connect with Professionals Who Get the Job Done in ${c}`,
      description: `Connect with verified professionals for any task in ${c}. 10% platform fee. AI-powered matching.`,
      url: `${baseUrl}`,
    },
  }
}

export default function Page() {
  return <Client />
}
