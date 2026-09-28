import { getAuthToken } from './token'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

export async function v2Request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers })
  if (!res.ok) {
    const raw = await res.text()
    let message = raw
    try {
      const parsed = raw ? JSON.parse(raw) : null
      if (parsed && typeof parsed.error === 'string') message = parsed.error
      else if (parsed && typeof parsed.message === 'string') message = parsed.message
    } catch {}
    throw new Error(message || `API Error ${res.status}`)
  }
  return res.json()
}
