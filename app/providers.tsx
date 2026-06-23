'use client'

import '@/lib/bigint-polyfill'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RegionProvider } from '@/lib/region-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <TooltipProvider>
          <RegionProvider>{children}</RegionProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
