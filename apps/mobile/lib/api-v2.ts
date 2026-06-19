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
  refundEscrow: (jobId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/escrow/refund`, { method: 'POST' }),
  shareAddress: (jobId: string, data: { street?: string; building?: string; apartment?: string; landmark?: string }) =>
    v2Request<{ job: V2Job }>(`/api/mobile/v2/jobs/${jobId}/share-address`, { method: 'POST', body: JSON.stringify(data) }),
  getWorkspace: (jobId: string) =>
    v2Request<{ workspace: any }>(`/api/mobile/v2/jobs/${jobId}/workspace`),
  updateProgress: (jobId: string, progressStatus: string) =>
    v2Request<{ workspace: any }>(`/api/mobile/v2/jobs/${jobId}/workspace`, { method: 'PATCH', body: JSON.stringify({ progressStatus }) }),
  complete: (jobId: string, action: string) =>
    v2Request<{ success: boolean; message: string }>(`/api/mobile/v2/jobs/${jobId}/complete`, { method: 'POST', body: JSON.stringify({ action }) }),
  releaseEscrow: (jobId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/release-escrow`, { method: 'POST' }),
  confirmCashPayment: (jobId: string) =>
    v2Request<{ success: boolean; commission: number; netAmount: number }>(`/api/mobile/v2/jobs/${jobId}/cash-payment`, { method: 'POST' }),
  createReview: (jobId: string, data: any) =>
    v2Request<{ review: any }>(`/api/mobile/v2/jobs/${jobId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  getReviews: (jobId: string) =>
    v2Request<{ reviews: any }>(`/api/mobile/v2/jobs/${jobId}/reviews`),
  dispute: (jobId: string) =>
    v2Request<{ success: boolean; message: string }>(`/api/mobile/v2/jobs/${jobId}/complete`, { method: 'POST', body: JSON.stringify({ action: 'DISPUTE' }) }),
  generateOtp: (jobId: string) =>
    v2Request<{ otp: string }>(`/api/mobile/v2/jobs/${jobId}/otp`, { method: 'POST' }),
  getOtp: (jobId: string) =>
    v2Request<{ otp: string | null }>(`/api/mobile/v2/jobs/${jobId}/otp`),
  verifyOtp: (jobId: string, otp: string) =>
    v2Request<{ success: boolean; message: string }>(`/api/mobile/v2/jobs/${jobId}/otp/verify`, { method: 'POST', body: JSON.stringify({ otp }) }),
}

export const v2Match = {
  getProviders: (jobId: string) =>
    v2Request<{ providers: any[] }>(`/api/mobile/v2/match/${jobId}`),
}

export const v2Wallet = {
  get: (role: string) =>
    v2Request<{ wallet: any; transactions: any[] }>(`/api/mobile/v2/wallet?role=${role}`),
  topUp: (amount: number) =>
    v2Request<{ success: boolean; balance: number }>('/api/mobile/v2/wallet', { method: 'POST', body: JSON.stringify({ amount, action: 'TOP_UP' }) }),
  withdraw: (amount: number) =>
    v2Request<{ success: boolean; balance: number }>('/api/mobile/v2/wallet', { method: 'POST', body: JSON.stringify({ amount, action: 'WITHDRAW' }) }),
}

export const v2Team = {
  list: () =>
    v2Request<{ members: any[]; pendingInvites: any[] }>('/api/mobile/company/team'),
  invite: (data: { name: string; email?: string; phone?: string; role?: string }) =>
    v2Request<{ success: boolean; invite: any }>('/api/mobile/company/team/invite', { method: 'POST', body: JSON.stringify(data) }),
  acceptInvite: (token: string) =>
    v2Request<{ success: boolean; teamMember: any }>('/api/mobile/company/team/accept', { method: 'POST', body: JSON.stringify({ token }) }),
  remove: (memberId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/company/team/${memberId}`, { method: 'DELETE' }),
  getMember: (memberId: string) =>
    v2Request<any>(`/api/mobile/company/team/${memberId}`),
}

export const v2Subscription = {
  getPlans: () =>
    v2Request<any[]>('/api/mobile/v2/subscription-plans'),
  getStatus: () =>
    v2Request<{ commissionRate: number; subscriptionStatus: string; subscriptionExpiresAt: string | null; activeSubscription: any | null }>('/api/mobile/company/subscription'),
  subscribe: (planId: string, autoRenew?: boolean) =>
    v2Request<{ success: boolean; subscription: any }>('/api/mobile/company/subscription', { method: 'POST', body: JSON.stringify({ planId, autoRenew }) }),
  cancel: () =>
    v2Request<{ success: boolean }>('/api/mobile/company/subscription', { method: 'DELETE' }),
}

export const v2Identity = {
  getStatus: () =>
    v2Request<{ identityStatus: string; documents: any[] }>('/api/mobile/v2/identity'),

  uploadDocument: (docType: string, side: string, imageUrl: string) =>
    v2Request<{ document: any }>('/api/mobile/v2/identity', {
      method: 'POST',
      body: JSON.stringify({ docType, side, imageUrl }),
    }),
}

// Offer Program API — for managing promotional offers that taskers/companies can opt into
// TODO: Replace with dedicated endpoints (/api/mobile/v2/offer-templates, /api/mobile/offer-enrollments, /api/mobile/offer-bookings)
export const offerProgram = {
  listTemplates: () =>
    v2Request<{ offers: any[] }>('/api/mobile/v2/jobs?category=offers'),

  enroll: (variant: 'tasker' | 'company', id: string) =>
    v2Request<{ success: boolean }>('/api/mobile/quick-bookings', {
      method: 'POST',
      body: JSON.stringify({ variant, id }),
    }),

  unenroll: (variant: 'tasker' | 'company') =>
    v2Request<{ success: boolean }>('/api/mobile/quick-bookings', {
      method: 'POST',
      body: JSON.stringify({ action: 'unenroll', variant }),
    }),

  createBooking: (data: {
    jobId: string
    taskerId: string
    date: string
    timeSlot: string
    address: string
    district: string
    notes?: string
  }) =>
    v2Request<{ id: string; status: string }>('/api/mobile/quick-bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
