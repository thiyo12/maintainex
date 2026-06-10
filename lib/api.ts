import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined'
    ? useAuthStore.getState().accessToken
    : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post('/api/admin/auth/refresh', {}, { withCredentials: true })
        if (data.accessToken) {
          useAuthStore.getState().setAccessToken(data.accessToken)
          failedQueue.forEach(({ resolve }) => resolve(data.accessToken))
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
          return api(originalRequest)
        }
      } catch {
        failedQueue.forEach(({ reject }) => reject(error))
        useAuthStore.getState().logout()
        if (typeof window !== 'undefined') {
          window.location.href = '/admin/login'
        }
      } finally {
        isRefreshing = false
        failedQueue = []
      }
    }
    return Promise.reject(error)
  },
)

export default api

// Lazy import to avoid circular deps
import { useAuthStore } from './auth-store'
