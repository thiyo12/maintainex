'use client'

import { create } from 'zustand'
import type { AdminRole } from './admin-types'

interface AdminUser {
  id: string
  email: string
  role: AdminRole
  firstName: string
  lastName: string
  assignedCountries: string[]
  authType: string
}

interface AuthState {
  accessToken: string | null
  adminUser: AdminUser | null
  setAccessToken: (token: string | null) => void
  setAdminUser: (user: AdminUser | null) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  adminUser: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setAdminUser: (user) => set({ adminUser: user }),
  logout: () => set({ accessToken: null, adminUser: null }),
  isAuthenticated: () => !!get().accessToken && !!get().adminUser,
}))
