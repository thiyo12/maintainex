import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { REGIONS } from '@/lib/regions'
import WaitlistContent from './client'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const regionKey = host.includes('ca.') ? 'CA' : 'LK'
  const c = REGIONS[regionKey].countryName
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  return {
    title: `Join the Waitlist — MaintainEX ${c}`,
    description: `Be the first to know when MaintainEX launches in ${c}. Early members get priority access to the trusted home services marketplace.`,
    alternates: { canonical: '/waitlist' },
    openGraph: {
      title: `Join the MaintainEX Waitlist — ${c}`,
      description: `Sign up for early access to MaintainEX. Trusted home services in ${c}.`,
      url: `${baseUrl}/waitlist`,
    },
  }
}

export default function WaitlistPage() {
  return <WaitlistContent />
}
