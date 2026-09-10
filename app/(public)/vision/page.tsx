import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { REGIONS } from '@/lib/regions'
import VisionContent from './client'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const regionKey = host.includes('ca.') ? 'CA' : 'LK'
  const c = REGIONS[regionKey].countryName
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  return {
    title: `Our Vision — Building the Future of Home Services in ${c}`,
    description: `Maintainex's mission to connect every home in ${c} with trusted, affordable taskers by 2027. Our vision for the future of local services.`,
    keywords: isCA
      ? `Maintainex vision, home services future Canada, task marketplace mission, local services innovation`
      : `Maintainex vision, home services future Sri Lanka, task marketplace mission, local services innovation`,
    alternates: {
      canonical: '/vision',
    },
    openGraph: {
      title: `Our Vision — Maintainex ${c}`,
      description: `Building the future of home services in ${c}. Our mission and vision for connecting communities with trusted taskers.`,
      url: `${baseUrl}/vision`,
    },
  }
}

export default function VisionPage() {
  return <VisionContent />
}
