import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { AppState } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { auth, notifications as notificationApi, setAuthToken } from '@/lib/api'
import { User } from '@/lib/types'

const SESSION_DURATION = 18 * 24 * 60 * 60 * 1000

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  signupData: { name: string; email: string; phone: string; role: string } | null
  setSignupData: (data: { name: string; email: string; phone: string; role: string } | null) => void
  login: (email: string, password: string) => Promise<any>
  loginWithOtp: (phone: string, otp: string) => Promise<any>
  sendLoginOtp: (identifier: string) => Promise<void>
  otpLogin: (identifier: string, code: string) => Promise<any>
  register: (data: { name: string; phone: string; email?: string; role: string }) => Promise<any>
  verifyRegisterOtp: (phone: string, code: string, purpose?: string) => Promise<any>
  switchRole: (role: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [signupData, setSignupData] = useState<{ name: string; email: string; phone: string; role: string } | null>(null)

  useEffect(() => {
    loadStoredAuth()
  }, [])

  // Heartbeat: keep last_active_at fresh on launch, foreground/background
  // transitions, and periodically while the app is in the foreground so the
  // 18-day inactivity session window is measured accurately.
  useEffect(() => {
    const touch = (force = false) => {
      const now = String(Date.now())
      if (force || AppState.currentState === 'active') {
        SecureStore.setItemAsync('last_active_at', now).catch(() => {})
      }
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background') touch(true)
    })

    touch(true)
    const interval = setInterval(() => touch(), 60000)

    return () => {
      sub.remove()
      clearInterval(interval)
    }
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

        let parsedUser: User | null = null
        try {
          parsedUser = JSON.parse(storedUser)
        } catch {
          await SecureStore.deleteItemAsync('auth_user')
          setUser(null)
          return
        }

        setUser(parsedUser)

        // Validate token against server with retry — only clear session on auth errors
        let retries = 2
        while (retries >= 0) {
          try {
            const meRes = await auth.me()
            const updatedUser = { ...parsedUser, ...meRes.user, needsOnboarding: meRes.needsOnboarding } as User
            setUser(updatedUser)
            await SecureStore.setItemAsync('auth_user', JSON.stringify(updatedUser))
            break
          } catch (err: any) {
            retries--
            // 401/403 = token revoked — clear session immediately
            if (err?.message?.includes('401') || err?.message?.includes('403') || err?.message?.includes('Unauthorized')) {
              await SecureStore.deleteItemAsync('auth_token')
              await SecureStore.deleteItemAsync('auth_user')
              await SecureStore.deleteItemAsync('last_active_at')
              setAuthToken(null)
              setUser(null)
              break
            }
            // Network/transient error — retry after delay
            if (retries >= 0) {
              await new Promise(r => setTimeout(r, 1000 * (2 - retries)))
            } else {
              // All retries exhausted — keep cached user, let app function offline
              console.warn('auth.me() failed after retries, using cached session')
            }
          }
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

  const sendLoginOtp = useCallback(async (identifier: string) => {
    const trimmed = identifier.trim()
    const isEmail = trimmed.includes('@')
    await auth.otpLogin(isEmail ? { email: trimmed } : { phone: trimmed })
  }, [])

  const otpLogin = useCallback(async (identifier: string, code: string) => {
    const trimmed = identifier.trim()
    const isEmail = trimmed.includes('@')
    const res = await auth.otpLogin(
      isEmail ? { email: trimmed, code } : { phone: trimmed, code }
    )
    await setAuthToken(res.token)

    let authenticatedUser = res.user as User
    try {
      const meRes = await auth.me()
      authenticatedUser = {
        ...authenticatedUser,
        ...meRes.user,
        needsOnboarding: meRes.needsOnboarding,
      } as User
    } catch {
      // The OTP session is still valid; onboarding can be resolved on next launch.
    }

    setUser(authenticatedUser)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(authenticatedUser))
    await SecureStore.setItemAsync('last_active_at', String(Date.now()))
    return authenticatedUser
  }, [])

  const register = useCallback(async (data: { name: string; phone: string; email?: string; role: string }) => {
    const res = await auth.register(data)
    return res
  }, [])

  const verifyRegisterOtp = useCallback(async (phone: string, code: string, purpose?: string) => {
    const res = await auth.verifyOtp({ phone, code, purpose: purpose || 'PHONE_VERIFICATION' })
    if (res.token) {
      await setAuthToken(res.token)
      setUser(res.user)
      await SecureStore.setItemAsync('auth_user', JSON.stringify(res.user))
      await SecureStore.setItemAsync('last_active_at', String(Date.now()))
      return res.user
    }
    return res
  }, [])

  const logout = useCallback(async () => {
    try {
      await notificationApi.unregisterPush()
    } catch {
      // Logout must still succeed if the device is offline.
    }
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
      const updatedUser = { ...res.user, needsOnboarding: res.needsOnboarding } as User
      setUser(updatedUser)
      await SecureStore.setItemAsync('auth_user', JSON.stringify(updatedUser))
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
        sendLoginOtp,
        otpLogin,
        register,
        verifyRegisterOtp,
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
