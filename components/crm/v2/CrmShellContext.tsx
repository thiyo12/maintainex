'use client'

import { createContext, useContext } from 'react'

export interface CrmMarketOption {
  code: string
  name: string
}

export interface CrmShellState {
  market: string
  setMarket: (market: string) => void
  markets: CrmMarketOption[]
}

const CrmShellContext = createContext<CrmShellState>({
  market: 'ALL',
  setMarket: () => undefined,
  markets: [],
})

export function useCrmShell() {
  return useContext(CrmShellContext)
}

export const CrmShellProvider = CrmShellContext.Provider
