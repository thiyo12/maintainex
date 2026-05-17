import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import { auth, setAuthToken } from './api'
import { User } from './types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  signupData: { name: string; email: string; phone: string; password: string; role: string } | null
  setSignupData: (data: { name: string; email: string; phone: string; password: string; role: string } | null) => void
  login: (email: string, password: string) => Promise<void>
  loginWithOtp: (phone: string, otp: string) => Promise<void>
  register: (data: { email: string; password: string; name: string; phone: string; role: string }) => Promise<void>
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
        setAuthToken(token)
        setUser(JSON.parse(storedUser))
      }
    } catch {
    } finally {
      setIsLoading(false)
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login({ email, password })
    setAuthToken(res.token)
    setUser(res.user)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(res.user))
  }, [])

  const loginWithOtp = useCallback(async (phone: string, otp: string) => {
    const res = await auth.loginWithOtp({ phone, otp })
    setAuthToken(res.token)
    setUser(res.user)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(res.user))
  }, [])

  const register = useCallback(async (data: { email: string; password: string; name: string; phone: string; role: string }) => {
    const res = await auth.register(data)
    setAuthToken(res.token)
    setUser(res.user)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(res.user))
  }, [])

  const logout = useCallback(async () => {
    setAuthToken(null)
    setUser(null)
    setSignupData(null)
    await SecureStore.deleteItemAsync('auth_token')
    await SecureStore.deleteItemAsync('auth_user')
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
