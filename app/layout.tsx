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
      default: isCA
        ? `Home Services in Toronto & Canada | Cleaning, Plumbing, Electrical & More | Maintainex`
        : `Home Services in Sri Lanka | Cleaning, Plumbing, Electrical & More | Maintainex`,
      template: `%s — Maintainex`,
    },
    description: isCA
      ? `Book trusted home services in Toronto & Ontario. Cleaning, plumbing, electrical, movers & more. Free quotes. Starting from $50.`
      : `Book trusted home services in Colombo, Kandy, Galle & Jaffna. Cleaning, plumbing, electrical, movers & more. Free quotes in minutes. Starting from LKR 1,200.`,
    keywords: isCA
      ? `home services Canada, cleaning service Toronto, plumber Ontario, electrician Canada, house cleaning Toronto, handyman Toronto, mover Toronto`
      : `home services Sri Lanka, cleaning service Colombo, plumber Colombo, electrician Sri Lanka, house cleaning Sri Lanka, handyman Colombo, home repair Sri Lanka, movers Colombo`,
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
      languages: {
        'x-default': baseUrl,
        'en-LK': 'https://maintainex.lk',
        'en-CA': 'https://ca.maintainex.lk',
      },
    },
    openGraph: {
      title: isCA ? `Book Home Services in Toronto & Canada | Maintainex` : `Book Home Services in Sri Lanka | Maintainex`,
      description: isCA
        ? `Canada's trusted platform for cleaning, plumbing, electrical & more. Vetted professionals. Free quotes. From $50.`
        : `Sri Lanka's trusted platform for cleaning, plumbing, electrical & more. Vetted professionals. Free quotes. Starting LKR 1,200.`,
      url: baseUrl,
      siteName: `Maintainex ${c}`,
      locale: isCA ? 'en_CA' : 'en_LK',
      type: 'website',
      images: [{ url: `${baseUrl}/logo.JPEG`, width: 1200, height: 630, alt: `Maintainex ${c}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: isCA ? `Book Home Services in Toronto & Canada | Maintainex` : `Book Home Services in Sri Lanka | Maintainex`,
      description: isCA
        ? `Canada's trusted platform for home services. Cleaning, plumbing, electrical & more. From $50.`
        : `Sri Lanka's trusted platform for home services. Cleaning, plumbing, electrical & more. From LKR 1,200.`,
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
        <Script id="schema-localbusiness" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "Maintainex",
            "url": baseUrl,
            "logo": `${baseUrl}/logo.JPEG`,
            "telephone": region === 'CA' ? '+14164279518' : '+94770867609',
            "description": region === 'CA'
              ? "Canada's trusted local marketplace for home and commercial services."
              : "Sri Lanka's trusted local marketplace for home and commercial services.",
            "areaServed": (region === 'CA'
              ? ['Toronto (Downtown)', 'Scarborough', 'North York', 'Etobicoke', 'Mississauga', 'Brampton', 'Markham', 'Richmond Hill', 'Vaughan', 'Oakville', 'Burlington', 'Milton']
              : ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Gampaha', 'Kalutara', 'Negombo', 'Kurunegala', 'Ratnapura', 'Badulla', 'Matara', 'Anuradhapura']
            ).map((name: string) => ({ "@type": "City", "name": name })),
            "priceRange": region === 'CA' ? 'CAD 50 - CAD 5,000' : 'LKR 1,200 - LKR 100,000',
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Home Services",
              "itemListElement": [
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Deep House Cleaning" }, "price": region === 'CA' ? "80" : "3461", "priceCurrency": region === 'CA' ? "CAD" : "LKR" },
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Plumbing & Water Repairs" }, "price": region === 'CA' ? "120" : "1500", "priceCurrency": region === 'CA' ? "CAD" : "LKR" },
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Electrical Fixes" }, "price": region === 'CA' ? "90" : "1200", "priceCurrency": region === 'CA' ? "CAD" : "LKR" },
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "House Movers" }, "price": region === 'CA' ? "350" : "5000", "priceCurrency": region === 'CA' ? "CAD" : "LKR" },
              ]
            }
          })}
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
