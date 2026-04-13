'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  branchId: string | null
  canEditServices?: boolean
}

interface SessionContextType {
  user: User | null
  loading: boolean
}

const SessionContext = createContext<SessionContextType>({ user: null, loading: true })

export function useAdminSession() {
  return useContext(SessionContext)
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('admin_user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        localStorage.removeItem('admin_user')
      }
    }

    fetch('/api/auth/session', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user)
          localStorage.setItem('admin_user', JSON.stringify(data.user))
        } else {
          localStorage.removeItem('admin_user')
          setUser(null)
        }
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  return (
    <SessionContext.Provider value={{ user, loading }}>
      {children}
    </SessionContext.Provider>
  )
}
