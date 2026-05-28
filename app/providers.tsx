'use client'

import { RegionProvider } from '@/lib/region-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return <RegionProvider>{children}</RegionProvider>
}
