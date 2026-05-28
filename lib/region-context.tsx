'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { REGIONS, Region, RegionConfig } from './regions'

function getRegionFromCookie(): Region {
  if (typeof document === 'undefined') return 'LK'
  const match = document.cookie.match(/(?:^|;\s*)region=([^;]*)/)
  return (match?.[1] as Region) || 'LK'
}

const RegionContext = createContext<RegionConfig>(REGIONS.LK)

export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegion] = useState<Region>('LK')

  useEffect(() => {
    setRegion(getRegionFromCookie())
  }, [])

  return (
    <RegionContext.Provider value={REGIONS[region]}>
      {children}
    </RegionContext.Provider>
  )
}

export function useRegion(): RegionConfig {
  return useContext(RegionContext)
}
