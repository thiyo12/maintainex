'use client'

import { AuthProvider } from '@/components/admin/AuthProvider'
import MarketplaceLayout from '@/components/admin/MarketplaceLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MarketplaceLayout>{children}</MarketplaceLayout>
    </AuthProvider>
  )
}
