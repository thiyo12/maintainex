'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getStoredUser, setStoredUser, clearStoredUser, type StoredUser } from '@/lib/auth-client'

interface SessionContextType {
  user: StoredUser | null
  loading: boolean
}

const SessionContext = createContext<SessionContextType>({ user: null, loading: true })

export function useAdminSession() {
  return useContext(SessionContext)
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = getStoredUser()
    if (storedUser) {
      setUser(storedUser)
    }
    setLoading(false)
  }, [])

  return (
    <SessionContext.Provider value={{ user, loading }}>
      {children}
    </SessionContext.Provider>
  )
}
