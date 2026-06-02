import { Toaster } from 'react-hot-toast'
import { headers } from 'next/headers'
import { Providers } from './providers'
import { REGIONS } from '@/lib/regions'
import { organizationSchema } from '@/lib/seo'
import type { Metadata } from 'next'
import './globals.css'

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
      template: `%s | Maintainex ${c}`,
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

  return (
    <html lang="en">
      <head>
        <link rel="canonical" href={baseUrl} />
        <link rel="alternate" hrefLang="en-LK" href="https://maintainex.lk" />
        <link rel="alternate" hrefLang="en-CA" href="https://ca.maintainex.lk" />
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{page_path:window.location.pathname});`,
              }}
            />
          </>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJson) }}
        />
      </head>
      <body className="min-h-screen bg-gray-50">
        <script
          dangerouslySetInnerHTML={{
            __html: `document.cookie="region=${region};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax"`,
          }}
        />
        <Providers>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#FFC300',
                color: '#1F2937',
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
