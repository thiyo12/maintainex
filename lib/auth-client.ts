const USER_KEY = 'admin_user'
const TOKEN_KEY = 'admin_token'

export interface StoredUser {
  id: string
  email: string
  name: string | null
  role: string
  branchId: string | null
  canEditServices?: boolean
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(USER_KEY)
    if (!stored) return null
    const user = JSON.parse(stored)
    if (user && user.id && user.email && user.role) {
      return user
    }
    return null
  } catch {
    return null
  }
}

export function setStoredUser(user: StoredUser): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredUser(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(USER_KEY)
}

export function getAuthHeader(): Record<string, string> {
  const user = getStoredUser()
  if (user) {
    return {
      'Authorization': `Bearer ${btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role, canEditServices: user.canEditServices }))}`
    }
  }
  return {}
}

export function isAuthenticated(): boolean {
  return getStoredUser() !== null
}
