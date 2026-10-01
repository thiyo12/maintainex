'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface AdminUser {
  id: string
  email: string
  role: string
  firstName?: string
  lastName?: string
  name: string | null
  assignedCountries?: string[]
  branchId: string | null
  province: string | null
  region: string | null
  canEditServices: boolean
  permissions: string[]
  totpEnabled: boolean
  sessionExpiresAt: string
}

interface SessionContextType {
  user: AdminUser | null
  loading: boolean
}

const SessionContext = createContext<SessionContextType>({ user: null, loading: true })

export function useAdminSession() {
  return useContext(SessionContext)
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/admin/auth/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        } else {
          setUser(null)
          router.push('/admin/login')
        }
      } catch {
        setUser(null)
        router.push('/admin/login')
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [router])

  return (
    <SessionContext.Provider value={{ user, loading }}>
      {children}
    </SessionContext.Provider>
  )
}
