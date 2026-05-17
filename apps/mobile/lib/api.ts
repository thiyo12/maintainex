import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import {
  AuthResponse,
  Booking,
  Category,
  JobPosting,
  TaskerProfile,
  Review,
  Notification,
  Bid,
} from './types'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

let authToken: string | null = null

export const setAuthToken = (token: string | null) => {
  authToken = token
  if (token) {
    SecureStore.setItemAsync('auth_token', token)
  } else {
    SecureStore.deleteItemAsync('auth_token')
  }
}

export const getAuthToken = async (): Promise<string | null> => {
  if (authToken) return authToken
  authToken = await SecureStore.getItemAsync('auth_token')
  return authToken
}

async function request<T>(
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

// Auth
export const auth = {
  register: (data: { email: string; password: string; name: string; phone: string; role: string }) =>
    request<AuthResponse>('/api/mobile/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/api/mobile/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  loginWithOtp: (data: { phone: string; otp: string }) =>
    request<AuthResponse>('/api/mobile/auth/login', { method: 'POST', body: JSON.stringify({ phone: data.phone, password: data.otp }) }),
  requestOtp: (phone: string) =>
    request<{ success: boolean }>('/api/mobile/auth/otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  sendOtp: (data: { phone: string; userId?: string }) =>
    request<{ success: boolean; devCode?: string }>('/api/mobile/auth/send-otp', { method: 'POST', body: JSON.stringify(data) }),
  verifyOtp: (data: { phone: string; code: string }) =>
    request<{ success: boolean }>('/api/mobile/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<{ user: import('./types').User }>('/api/mobile/auth/me'),
}

// Categories & Services
export const categories = {
  list: () => request<Category[]>('/api/categories'),
  get: (slug: string) => request<Category>(`/api/categories/${slug}`),
}

// Bookings
export const bookings = {
  create: (data: any) =>
    request<{ booking: Booking }>('/api/mobile/bookings', { method: 'POST', body: JSON.stringify(data) }),
  list: (params?: string) =>
    request<Booking[]>(`/api/mobile/bookings${params ? `?${params}` : ''}`),
  get: (id: string) => request<Booking>(`/api/mobile/bookings/${id}`),
}

// Jobs (marketplace)
export const jobs = {
  list: (params?: string) =>
    request<JobPosting[]>(`/api/mobile/jobs${params ? `?${params}` : ''}`),
  get: (id: string) => request<JobPosting>(`/api/mobile/jobs/${id}`),
  create: (data: any) =>
    request<JobPosting>('/api/mobile/jobs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<JobPosting>(`/api/mobile/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/api/mobile/jobs/${id}`, { method: 'DELETE' }),
  bid: (jobId: string, data: { amount: number; message: string }) =>
    request<Bid>(`/api/mobile/jobs/${jobId}/bid`, { method: 'POST', body: JSON.stringify(data) }),
  assign: (jobId: string, taskerId: string) =>
    request<JobPosting>(`/api/mobile/jobs/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'ASSIGNED' }) }),
  start: (jobId: string) =>
    request<JobPosting>(`/api/mobile/jobs/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'IN_PROGRESS' }) }),
  complete: (jobId: string) =>
    request<JobPosting>(`/api/mobile/jobs/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'COMPLETED' }) }),
  cancel: (jobId: string) =>
    request<JobPosting>(`/api/mobile/jobs/${jobId}`, { method: 'PUT', body: JSON.stringify({ status: 'CANCELLED' }) }),
}

// Taskers
export const taskers = {
  list: (params?: string) =>
    request<TaskerProfile[]>(`/api/mobile/taskers${params ? `?${params}` : ''}`),
  get: (id: string) => request<TaskerProfile>(`/api/mobile/taskers/${id}`),
  updateProfile: (data: any) =>
    request<TaskerProfile>('/api/mobile/taskers/profile', { method: 'PUT', body: JSON.stringify(data) }),
  updateLocation: (data: { latitude: number; longitude: number }) =>
    request<void>('/api/mobile/taskers/location', { method: 'PUT', body: JSON.stringify(data) }),
  setOnline: (isOnline: boolean) =>
    request<void>('/api/mobile/taskers/status', { method: 'PUT', body: JSON.stringify({ isOnline }) }),
  reviews: (taskerId: string) =>
    request<Review[]>(`/api/mobile/taskers/${taskerId}/reviews`),
}

// Notifications
export const notifications = {
  list: () => request<Notification[]>('/api/mobile/notifications'),
  registerPush: (token: string) =>
    request<void>('/api/mobile/notifications', { method: 'POST', body: JSON.stringify({ token }) }),
  markRead: (id: string) =>
    request<void>(`/api/mobile/notifications/${id}`, { method: 'PUT' }),
}

// Conversations & Messages
export const conversations = {
  list: () =>
    request<{ id: string; otherUser: { id: string; name: string } | null; lastMessage: any; unreadCount: number; updatedAt: string }[]>('/api/mobile/conversations'),
  create: (data: { participantId: string; jobId?: string; initialMessage?: string }) =>
    request<{ id: string; existing: boolean }>('/api/mobile/conversations', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) =>
    request<{ id: string; participants: any[]; messages: any[] }>(`/api/mobile/conversations/${id}`),
  sendMessage: (conversationId: string, text: string) =>
    request<any>(`/api/mobile/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),
  getMessages: (conversationId: string, after?: string) =>
    request<any[]>(`/api/mobile/conversations/${conversationId}/messages${after ? `?after=${after}` : ''}`),
}

// Disputes
export const disputes = {
  create: (data: { jobId: string; reason: string; description: string }) =>
    request<{ id: string; status: string }>('/api/mobile/disputes', { method: 'POST', body: JSON.stringify(data) }),
  list: () =>
    request<{ id: string; jobTitle: string; reason: string; status: string; createdAt: string }[]>('/api/mobile/disputes'),
  get: (id: string) =>
    request<any>(`/api/mobile/disputes/${id}`),
}

// Company
export const company = {
  profile: {
    get: () => request<any>('/api/mobile/company/profile'),
    update: (data: any) => request<any>('/api/mobile/company/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },
  contracts: {
    list: (params?: string) =>
      request<any[]>(`/api/mobile/company/contracts${params ? `?${params}` : ''}`),
    get: (id: string) => request<any>(`/api/mobile/company/contracts/${id}`),
    update: (id: string, data: any) =>
      request<any>(`/api/mobile/company/contracts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  milestones: {
    list: (params?: string) =>
      request<any[]>(`/api/mobile/company/milestones${params ? `?${params}` : ''}`),
  },
  team: {
    list: () => request<any[]>('/api/mobile/company/team'),
  },
  earnings: {
    get: () => request<any>('/api/mobile/company/earnings'),
  },
}

// Earnings & Payouts
export const earnings = {
  get: () => request<any>('/api/mobile/earnings'),
  withdraw: (amount: number) =>
    request<any>('/api/mobile/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
}

// File upload
export const upload = {
  file: async (fileUri: string) => {
    const token = await getAuthToken()
    const formData = new FormData()
    const filename = fileUri.split('/').pop() || 'photo.jpg'
    const ext = filename.split('.').pop() || 'jpg'
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: `image/${ext}`,
    } as any)
    const res = await fetch(`${API_URL}/api/mobile/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) throw new Error('Upload failed')
    return res.json() as Promise<{ url: string; filename: string }>
  },
}
