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
    description: `MaintainEX connects customers with verified professionals for personal, business and local tasks in ${c}. Join our launch waitlist.`,
    openGraph: { description: `A trusted marketplace for tasks and professional services in ${c}.` },
  }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const region = getRegionFromHost(host)
  const runtime = await getPlatformRuntimeConfig(region).catch(() => null)

  if (
    runtime &&
    (
      runtime.maintenance.enabled ||
      !runtime.channels.website ||
      !runtime.market.available
    )
  ) {
    redirect('/maintenance')
  }

  return (
    <>
      {runtime && (
        <PublicRuntimeBanner
          enabled={runtime.banner.enabled}
          message={runtime.banner.message}
          severity={runtime.banner.severity}
        />
      )}
      {children}
    </>
  )
}
