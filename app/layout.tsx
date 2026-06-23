import { Toaster } from 'react-hot-toast'
import { headers } from 'next/headers'
import { Providers } from './providers'
import { REGIONS } from '@/lib/regions'
import { organizationSchema, websiteSchema } from '@/lib/seo'
import type { Metadata } from 'next'
import Script from 'next/script'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], display: 'swap' })


export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = host.includes('ca.') ? 'CA' : 'LK'
  const c = REGIONS[regionKey].countryName
  const cp = REGIONS[regionKey].countryNamePossessive
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  const gscId = process.env.NEXT_PUBLIC_GSC_ID

  return {
    metadataBase: new URL(process.env.NEXTAUTH_URL || baseUrl),
    title: {
      default: `Maintainex ${c} - Professional Cleaning & Home Services in ${c}`,
      template: `%s — Maintainex`,
    },
    description: `${cp} #1 professional cleaning services. Home cleaning, office cleaning, deep cleaning, and maintenance services across ${c}. Book online or call us today.`,
    keywords: `cleaning services ${c}, home cleaning ${c}, office cleaning ${c}, deep cleaning, maintenance services, ${c} cleaners, professional cleaning company ${c}`,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    icons: {
      icon: '/favicon.svg',
      shortcut: '/favicon.svg',
    },
    alternates: {
      canonical: baseUrl,
      languages: {
        'x-default': baseUrl,
        'en-LK': 'https://maintainex.lk',
        'en-CA': 'https://ca.maintainex.lk',
      },
    },
    openGraph: {
      title: `Maintainex ${c} - Professional Cleaning & Home Services`,
      description: `${cp} trusted cleaning services for homes and businesses. Book online for free!`,
      url: baseUrl,
      siteName: `Maintainex ${c}`,
      locale: isCA ? 'en_CA' : 'en_LK',
      type: 'website',
      images: [{ url: `${baseUrl}/logo.JPEG`, width: 1200, height: 630, alt: `Maintainex ${c}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Maintainex ${c} - Cleaning & Home Services`,
      description: `${cp} #1 cleaning services. Book online!`,
      images: [`${baseUrl}/logo.JPEG`],
    },
    other: {
      ...(gaId ? { 'google-analytics': gaId } : {}),
      ...(gscId ? { 'google-site-verification': gscId } : {}),
    },
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const region = host.includes('ca.') ? 'CA' : 'LK'
  const baseUrl = region === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  const orgJson = organizationSchema(region)
  const siteJson = websiteSchema(region)

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="llms-txt" href={`${baseUrl}/llms.txt`} />
        <meta name="llms" content={`${baseUrl}/llms.txt`} />
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{page_path:window.location.pathname});`}
            </Script>
          </>
        )}
        <Script id="schema-org" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify(orgJson)}
        </Script>
        <Script id="schema-website" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify(siteJson)}
        </Script>
      </head>
      <body className={`${outfit.className} min-h-screen bg-background dark:text-gray-100`}>
        <Script id="region-cookie" strategy="afterInteractive">
          {`document.cookie="region=${region};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax"`}
        </Script>
        <Providers>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#F59E0B',
                color: '#2C2416',
                fontWeight: 600,
              },
              success: {
                iconTheme: {
                  primary: '#059669',
                  secondary: '#fff',
                },
              },
            }}
          />
          {children}
        </Providers>
      </body>
    </html>
  )
}
