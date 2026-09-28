import { getAuthToken } from './token'

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

export function resolveImageUri(uri?: string | null): string | null {
  if (!uri) return null
  if (uri.startsWith('/api/mobile/files/')) return null // legacy, not publicly readable
  return uri.startsWith('http') ? uri : `${API_URL}${uri}`
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(error || `API Error ${res.status}`)
  }

  return res.json()
}
