import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'
import PublicRuntimeBanner from '@/components/runtime/PublicRuntimeBanner'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const c = REGIONS[getRegionFromHost(host)].countryName
  return {
    description: `Browse professional cleaning and home maintenance services in ${c}. Book online with Maintainex ${c} today.`,
    openGraph: { description: `Professional home services in ${c}.` },
  }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const region = getRegionFromHost(host)
  const runtime = await getPlatformRuntimeConfig(region)

  if (
    runtime.maintenance.enabled ||
    !runtime.channels.website ||
    !runtime.market.available
  ) {
    redirect('/maintenance')
  }

  return (
    <>
      <PublicRuntimeBanner
        enabled={runtime.banner.enabled}
        message={runtime.banner.message}
        severity={runtime.banner.severity}
      />
      {children}
    </>
  )
}
