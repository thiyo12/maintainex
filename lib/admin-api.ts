import axios from 'axios'

let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

async function doRefresh(): Promise<string | null> {
  try {
    const res = await axios.post('/api/admin/auth/refresh', {}, { withCredentials: true })
    const { accessToken: newToken } = res.data
    if (newToken) {
      accessToken = newToken
      return newToken
    }
    return null
  } catch {
    accessToken = null
    return null
  }
}

const api = axios.create({
  baseURL: '/api/admin',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      if (!refreshPromise) {
        refreshPromise = doRefresh()
      }
      const newToken = await refreshPromise
      refreshPromise = null
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      }
    }
    return Promise.reject(error)
  }
)

export default api
