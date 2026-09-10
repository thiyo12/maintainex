import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Script from 'next/script'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import { breadcrumbSchema, organizationSchema } from '@/lib/seo'
import AboutClient from './client'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const baseUrl = regionKey === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  return {
    title: `About MaintainEX — Sri Lanka & Canada's Home Services App`,
    description: `MaintainEX connects you with trusted professionals for cleaning, plumbing, electrical, painting, and 50+ home services. Download the app and book in minutes.`,
    alternates: { canonical: `${baseUrl}/about` },
    openGraph: {
      title: `About MaintainEX — Home Services App`,
      description: `One app for all your home service needs. Cleaning, repairs, maintenance & more. Available in Sri Lanka & Canada.`,
    },
  }
}

export default async function AboutPage() {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const baseUrl = regionKey === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  const breadcrumb = breadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: 'About', url: `${baseUrl}/about` },
  ])

  return (
    <>
      <Script id="breadcrumb-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(breadcrumb)}
      </Script>
      <Script id="org-schema-about" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(organizationSchema(regionKey))}
      </Script>
      <AboutClient />
    </>
  )
}
