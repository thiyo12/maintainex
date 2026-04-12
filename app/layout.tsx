import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Maintainex - Professional Cleaning Services in Sri Lanka',
  description: 'Premium cleaning services for homes and businesses in Sri Lanka. Home cleaning, industrial cleaning, and more.',
  keywords: 'cleaning services, Sri Lanka, home cleaning, office cleaning, deep cleaning, industrial cleaning',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Maintainex - Professional Cleaning Services',
    description: 'Premium cleaning services for homes and businesses in Sri Lanka',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
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
