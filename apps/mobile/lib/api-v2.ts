import { getAuthToken } from './api'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk'

async function v2Request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `API Error ${res.status}`)
  }
  return res.json()
}

export interface V2Job {
  id: string
  customerId: string
  title: string
  description: string
  categoryId: string
  photos: string[]
  budgetType: string
  budgetAmount: number
  areaId: string | null
  postalCode: string | null
  preferredDate: string | null
  addressStreet: string | null
  addressBuilding: string | null
  addressApartment: string | null
  addressLandmark: string | null
  addressSharedAt: string | null
  status: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  customer?: any
  locationName?: string | null
  quotes?: V2Quote[]
  escrow?: any
  workspace?: any
  reviews?: any
}

export interface V2Quote {
  id: string
  jobId: string
  providerId: string
  providerType: string
  price: number
  estimatedCompletionTime: string
  message: string
  attachments: string[]
  status: string
  createdAt: string
  provider?: any
  providerRating?: number
  completedJobs?: number
}

export const v2Locations = {
  get: () => v2Request<{ countries: any[] }>('/api/mobile/v2/locations'),
}

export const v2Jobs = {
  create: (data: any) =>
    v2Request<{ job: V2Job }>('/api/mobile/v2/jobs', { method: 'POST', body: JSON.stringify(data) }),
  list: (params?: string) =>
    v2Request<{ jobs: V2Job[] }>(`/api/mobile/v2/jobs${params ? `?${params}` : ''}`),
  get: (id: string) =>
    v2Request<{ job: V2Job & { quotes: V2Quote[] } }>(`/api/mobile/v2/jobs/${id}`),
}

export const v2Quotes = {
  submit: (data: { jobId: string; providerType: string; price: number; estimatedCompletionTime?: string; message?: string }) =>
    v2Request<{ quote: V2Quote }>('/api/mobile/v2/quotes', { method: 'POST', body: JSON.stringify(data) }),
  list: (jobId: string) =>
    v2Request<{ quotes: V2Quote[] }>(`/api/mobile/v2/quotes?jobId=${jobId}`),
}

export const v2JobActions = {
  selectQuote: (jobId: string, quoteId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/select-quote`, { method: 'POST', body: JSON.stringify({ quoteId }) }),
  depositEscrow: (jobId: string, amount: number) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/escrow`, { method: 'POST', body: JSON.stringify({ amount }) }),
  getEscrow: (jobId: string) =>
    v2Request<{ escrow: any }>(`/api/mobile/v2/jobs/${jobId}/escrow`),
  shareAddress: (jobId: string, data: { street?: string; building?: string; apartment?: string; landmark?: string }) =>
    v2Request<{ job: V2Job }>(`/api/mobile/v2/jobs/${jobId}/share-address`, { method: 'POST', body: JSON.stringify(data) }),
  getWorkspace: (jobId: string) =>
    v2Request<{ workspace: any }>(`/api/mobile/v2/jobs/${jobId}/workspace`),
  updateProgress: (jobId: string, progressStatus: string) =>
    v2Request<{ workspace: any }>(`/api/mobile/v2/jobs/${jobId}/workspace`, { method: 'PATCH', body: JSON.stringify({ progressStatus }) }),
  markComplete: (jobId: string, action: string) =>
    v2Request<{ success: boolean; message: string }>(`/api/mobile/v2/jobs/${jobId}/complete`, { method: 'POST', body: JSON.stringify({ action }) }),
  releaseEscrow: (jobId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/release-escrow`, { method: 'POST' }),
  createReview: (jobId: string, data: any) =>
    v2Request<{ review: any }>(`/api/mobile/v2/jobs/${jobId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  getReviews: (jobId: string) =>
    v2Request<{ reviews: any }>(`/api/mobile/v2/jobs/${jobId}/reviews`),
}

export const v2Wallet = {
  get: (role: string) =>
    v2Request<{ wallet: any; transactions: any[] }>(`/api/mobile/v2/wallet?role=${role}`),
  topUp: (amount: number) =>
    v2Request<{ success: boolean; balance: number }>('/api/mobile/v2/wallet', { method: 'POST', body: JSON.stringify({ amount, action: 'TOP_UP' }) }),
  withdraw: (amount: number) =>
    v2Request<{ success: boolean; balance: number }>('/api/mobile/v2/wallet', { method: 'POST', body: JSON.stringify({ amount, action: 'WITHDRAW' }) }),
}
