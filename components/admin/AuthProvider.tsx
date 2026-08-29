'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { setAccessToken } from '@/lib/admin-api'

export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'SUPER_ADMIN' | 'MANAGER' | 'FINANCE' | 'USER_MANAGEMENT' | 'SUPPORT' | 'TECHNICAL'
  assignedCountries: string[]
}

interface AuthContextType {
  user: AdminUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ requires2fa: boolean; tempToken?: string }>
  verify2fa: (tempToken: string, totpCode: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/refresh', { method: 'POST', credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.accessToken) {
          setAccessToken(data.accessToken)
          const payload = JSON.parse(atob(data.accessToken.split('.')[1]))
          setUser({
            id: payload.sub,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            role: payload.role,
            assignedCountries: payload.assignedCountries || [],
          })
        }
      }
    } catch {
      setUser(null)
      setAccessToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    if (data.requires2fa) {
      return { requires2fa: true, tempToken: data.tempToken }
    }
    setAccessToken(data.accessToken)
    setUser(data.user)
    return { requires2fa: false }
  }, [])

  const verify2fa = useCallback(async (tempToken: string, totpCode: string) => {
    const res = await fetch('/api/admin/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, totpCode }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Verification failed')
    setAccessToken(data.accessToken)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
    } finally {
      setUser(null)
      setAccessToken(null)
      router.push('/admin/login')
    }
  }, [router])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, verify2fa, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
