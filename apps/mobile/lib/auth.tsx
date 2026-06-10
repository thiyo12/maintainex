import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import { auth, setAuthToken } from './api'
import { User } from './types'

const SESSION_DURATION = 5 * 24 * 60 * 60 * 1000

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  signupData: { name: string; email: string; phone: string; password: string; role: string } | null
  setSignupData: (data: { name: string; email: string; phone: string; password: string; role: string } | null) => void
  login: (email: string, password: string) => Promise<any>
  loginWithOtp: (phone: string, otp: string) => Promise<any>
  register: (data: { email: string; password: string; name: string; phone: string; role: string }) => Promise<any>
  switchRole: (role: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [signupData, setSignupData] = useState<{ name: string; email: string; phone: string; password: string; role: string } | null>(null)

  useEffect(() => {
    loadStoredAuth()
  }, [])

  const loadStoredAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token')
      const storedUser = await SecureStore.getItemAsync('auth_user')
      if (token && storedUser) {
        const lastActive = await SecureStore.getItemAsync('last_active_at')
        if (lastActive) {
          const elapsed = Date.now() - parseInt(lastActive, 10)
          if (elapsed > SESSION_DURATION) {
            await SecureStore.deleteItemAsync('auth_token')
            await SecureStore.deleteItemAsync('auth_user')
            await SecureStore.deleteItemAsync('last_active_at')
            setAuthToken(null)
            setUser(null)
            return
          }
        }
        await SecureStore.setItemAsync('last_active_at', String(Date.now()))
        await setAuthToken(token)
        setUser(JSON.parse(storedUser))
        // Validate token against server — if stale, clear session
        try {
        const meRes = await auth.me()
        setUser({ ...JSON.parse(storedUser), needsOnboarding: meRes.needsOnboarding })
        await SecureStore.setItemAsync('auth_user', JSON.stringify({ ...JSON.parse(storedUser), needsOnboarding: meRes.needsOnboarding }))
        } catch {
          await SecureStore.deleteItemAsync('auth_token')
          await SecureStore.deleteItemAsync('auth_user')
          await SecureStore.deleteItemAsync('last_active_at')
          setAuthToken(null)
          setUser(null)
        }
      }
    } catch {
    } finally {
      setIsLoading(false)
    }
  }

  const redirectByRole = (role: string) => {
    // Can't access router here, return role for caller to handle
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login({ email, password })
    await setAuthToken(res.token)
    setUser(res.user)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(res.user))
    await SecureStore.setItemAsync('last_active_at', String(Date.now()))
    return res.user
  }, [])

  const loginWithOtp = useCallback(async (phone: string, otp: string) => {
    const res = await auth.loginWithOtp({ phone, otp })
    await setAuthToken(res.token)
    setUser(res.user)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(res.user))
    await SecureStore.setItemAsync('last_active_at', String(Date.now()))
    return res.user
  }, [])

  const register = useCallback(async (data: { email: string; password: string; name: string; phone: string; role: string }) => {
    const res = await auth.register(data)
    await setAuthToken(res.token)
    setUser(res.user)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(res.user))
    await SecureStore.setItemAsync('last_active_at', String(Date.now()))
    return res.user
  }, [])

  const logout = useCallback(async () => {
    await setAuthToken(null)
    setUser(null)
    setSignupData(null)
    await SecureStore.deleteItemAsync('auth_token')
    await SecureStore.deleteItemAsync('auth_user')
    await SecureStore.deleteItemAsync('last_active_at')
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await auth.me()
      setUser(res.user)
      await SecureStore.setItemAsync('auth_user', JSON.stringify(res.user))
    } catch {
      await logout()
    }
  }, [logout])

  const switchRole = useCallback(async (role: string) => {
    const res = await auth.switchRole(role)
    await setAuthToken(res.token)
    setUser(res.user)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(res.user))
    await SecureStore.setItemAsync('last_active_at', String(Date.now()))
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signupData,
        setSignupData,
        login,
        loginWithOtp,
        register,
        switchRole,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
