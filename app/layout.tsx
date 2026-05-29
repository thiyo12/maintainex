import { Toaster } from 'react-hot-toast'
import { headers } from 'next/headers'
import { Providers } from './providers'
import { REGIONS } from '@/lib/regions'
import type { Metadata } from 'next'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = host.includes('ca.') ? 'CA' : 'LK'
  const c = REGIONS[regionKey].countryName

  return {
    metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
    title: 'Maintain - Shine Beyond Expectations',
    description: `Professional cleaning services in ${c}. Home cleaning, office cleaning, industrial cleaning, and more.`,
    keywords: `cleaning services, ${c}, home cleaning, office cleaning, deep cleaning, industrial cleaning`,
    icons: {
      icon: '/favicon.svg',
      shortcut: '/favicon.svg',
    },
    openGraph: {
      title: 'Maintain - Professional Cleaning Services',
      description: `Premium cleaning services for homes and businesses in ${c}`,
      type: 'website',
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

  return (
    <html lang="en">
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
