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
  budgetAmount: number | null
  areaId: string | null
  postalCode: string | null
  preferredDate: string | null
  timeSlot: string | null
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
  get: (id: string, context?: 'company') =>
    v2Request<{ job: V2Job & { quotes: V2Quote[] } }>(
      `/api/mobile/v2/jobs/${id}${context ? `?context=${context}` : ''}`
    ),
  pollNew: (since: string) =>
    v2Request<{ jobs: V2Job[] }>(`/api/mobile/v2/jobs?role=provider&after=${encodeURIComponent(since)}`),
  getTaskerLocation: (id: string) =>
    v2Request<{ sharing: boolean; location: { providerId: string; latitude: number; longitude: number; updatedAt: string } | null }>(`/api/mobile/taskers/${id}/location`),
}

export const v2Quotes = {
  submit: (data: { jobId: string; providerType: string; price: number; estimatedCompletionTime?: string; message?: string }) =>
    v2Request<{ quote: V2Quote }>('/api/mobile/v2/quotes', { method: 'POST', body: JSON.stringify(data) }),
  list: (jobId: string) =>
    v2Request<{ quotes: V2Quote[] }>(`/api/mobile/v2/quotes?jobId=${jobId}`),
}

export const v2JobActions = {
  update: (jobId: string, data: any) =>
    v2Request<{ job: V2Job }>(`/api/mobile/v2/jobs/${jobId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  selectQuote: (jobId: string, quoteId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/select-quote`, { method: 'POST', body: JSON.stringify({ quoteId }) }),
  depositEscrow: (jobId: string, amount: number) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/escrow`, { method: 'POST', body: JSON.stringify({ amount }) }),
  getEscrow: (jobId: string) =>
    v2Request<{ escrow: any }>(`/api/mobile/v2/jobs/${jobId}/escrow`),
  refundEscrow: (jobId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/escrow/refund`, { method: 'POST' }),
  cancel: (jobId: string, reason?: string) =>
    v2Request<{ success: boolean; status: string; refunded: boolean; cancelledBy: string }>(
      `/api/mobile/v2/jobs/${jobId}/cancel`,
      { method: 'POST', body: JSON.stringify({ reason: reason || 'Cancelled by user' }) }
    ),
  shareAddress: (jobId: string, data: { street?: string; building?: string; apartment?: string; landmark?: string }) =>
    v2Request<{ job: V2Job }>(`/api/mobile/v2/jobs/${jobId}/share-address`, { method: 'POST', body: JSON.stringify(data) }),
  getWorkspace: (jobId: string) =>
    v2Request<{ workspace: any }>(`/api/mobile/v2/jobs/${jobId}/workspace`),
  updateProgress: (jobId: string, progressStatus: string) =>
    v2Request<{ workspace: any }>(`/api/mobile/v2/jobs/${jobId}/workspace`, { method: 'PATCH', body: JSON.stringify({ progressStatus }) }),
  complete: (jobId: string, action: string, reason?: string) =>
    v2Request<{ success: boolean; message: string }>(`/api/mobile/v2/jobs/${jobId}/complete`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
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
  getPinState: (jobId: string) =>
    v2Request<{ pinState: { hasActivePin: boolean; version: number | null; locked: boolean; lastSuccessfulUseAt: string | null } }>(`/api/mobile/v2/jobs/${jobId}/pin`),
  generatePin: (jobId: string) =>
    v2Request<{ success: boolean; pin: string; version: number }>(`/api/mobile/v2/jobs/${jobId}/pin`, { method: 'POST' }),
  rotatePin: (jobId: string) =>
    v2Request<{ success: boolean; pin: string; version: number }>(`/api/mobile/v2/jobs/${jobId}/pin/rotate`, { method: 'POST' }),
  revokePin: (jobId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/pin/revoke`, { method: 'POST' }),
  verifyPin: (jobId: string, pin: string, purpose: string) =>
    v2Request<{ success: boolean; purpose: string }>(`/api/mobile/v2/jobs/${jobId}/pin/verify`, { method: 'POST', body: JSON.stringify({ pin, purpose }) }),
  getCustomerStatus: (jobId: string) =>
    v2Request<{ status: any }>(`/api/mobile/v2/jobs/${jobId}/customer-status`),
}

export const v2Match = {
  getProviders: (jobId: string) =>
    v2Request<{ providers: any[] }>(`/api/mobile/v2/match/${jobId}`),
}

export interface SubTask {
  id: string
  name: string
  description: string
  priceRangeLKR: { min: number; max: number }
  priceRangeCAD: { min: number; max: number }
  estimatedTime: string
  difficulty: 'easy' | 'medium' | 'hard'
  tips: string[]
}

export const v2SubTasks = {
  getByCategory: (categoryId: string, categoryName?: string) =>
    v2Request<{ categoryId: string; subTasks: SubTask[] }>(
      `/api/mobile/v2/subtasks?categoryId=${encodeURIComponent(categoryId)}${categoryName ? `&categoryName=${encodeURIComponent(categoryName)}` : ''}`
    ),
}

export const v2Wallet = {
  get: (role: string) =>
    v2Request<{ wallet: any; transactions: any[] }>(`/api/mobile/v2/wallet?role=${role}`),
  topUp: (amount: number) =>
    v2Request<{ success: boolean; paymentUrl?: string; orderId?: string; method?: string }>('/api/mobile/v2/wallet/topup', { method: 'POST', body: JSON.stringify({ amount }) }),
  withdraw: (amount: number) =>
    v2Request<{ success: boolean; balance: number }>('/api/mobile/v2/wallet', { method: 'POST', body: JSON.stringify({ amount, action: 'WITHDRAW' }) }),
  withdrawPayout: (amount: number) =>
    v2Request<{ id: string; amount: number; status: string; createdAt: string }>('/api/mobile/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
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

  uploadDocument: (docType: string, side: string, imageUrl: string, fullName?: string) =>
    v2Request<{ document: any }>('/api/mobile/v2/identity', {
      method: 'POST',
      body: JSON.stringify({ docType, side, imageUrl, fullName }),
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

export interface PriceBreakdownItem {
  label: string
  amount: number
  amountRange?: { min: number; max: number }
}

export interface MarketInsight {
  comparison: 'below_average' | 'average' | 'slightly_above' | 'premium'
  percentage: number
  label: string
}

export interface DetectedMaterial {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  source: string
}

export interface PriceEstimate {
  currency: string
  symbol: string
  priceRange: { min: number; max: number; base: number }
  breakdown: PriceBreakdownItem[]
  marketInsight: MarketInsight
  timeEstimate: string
  confidence: 'high' | 'medium' | 'low'
  warning: string | null
  suggestion: string | null
  materialHandling?: 'tasker_brings' | 'customer_provides' | 'quote_both'
  materials?: DetectedMaterial[]
  totalMaterialCost?: number
  labourOnlyRange?: { min: number; max: number }
  withMaterialsRange?: { min: number; max: number }
}

export const v2Pricing = {
  getEstimate: (data: {
    categoryId: string
    categoryName?: string
    description: string
    title?: string
    areaId?: string
    cityId?: string
    countryCode?: string
    urgency?: string
    preferredDate?: string
    preferredTime?: string
    estimatedDuration?: number
    workersCount?: number
    materialHandling?: 'tasker_brings' | 'customer_provides' | 'quote_both'
  }) => v2Request<PriceEstimate>('/api/mobile/v2/pricing/estimate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getMaterials: (data: {
    categoryId: string
    description: string
    title?: string
    countryCode?: string
  }) => v2Request<{
    materials: { name: string; quantity: number; unit: string; unitPrice: number; totalPrice: number; source: string }[]
    totalMaterialCost: number
    labourRange: { min: number; max: number }
    currency: string
    symbol: string
    confidence: string
    hasMaterials: boolean
  }>('/api/mobile/v2/pricing/materials', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
}

export interface SmartQuestionOption {
  label: string
  value: string
  priceEffect?: number
}
export interface SmartQuestion {
  key: string
  label: string
  type: 'single' | 'multi' | 'text' | 'number'
  options?: SmartQuestionOption[]
  placeholder?: string
  required?: boolean
}
export interface SmartTemplate {
  id: string
  slug: string
  name: string
  description: string
  jobCategory: { id: string; name: string; slug: string | null }
  questions: SmartQuestion[]
  defaultDurationMinutes: number
  priceMin: number
  priceMax: number
  currency: string
  refJob: { id: string; name: string; durationMinutes: number; priceMin: number; priceMax: number } | null
}
export interface SmartPriceEstimate {
  currency: string
  symbol: string
  priceRange: { min: number; max: number; base: number }
  breakdown: { label: string; factor: number }[]
  timeEstimateMinutes: number
  confidence: 'high' | 'medium' | 'low'
}

export const v2SmartBooking = {
  templates: (jobCategoryId?: string) =>
    v2Request<SmartTemplate[]>(
      `/api/mobile/v2/service-templates${jobCategoryId ? `?jobCategoryId=${encodeURIComponent(jobCategoryId)}` : ''}`
    ),
  priceEstimate: (data: { templateId: string; answers: Record<string, any>; countryCode?: string; urgency?: string }) =>
    v2Request<SmartPriceEstimate>('/api/mobile/v2/price-estimate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

export interface SearchResult {
  id: string
  name: string
  slug: string
  score: number
  matchType: string
  subcategories: string[]
}

export const v2Search = {
  categories: (q: string, lang?: string) =>
    v2Request<{
      query: string; lang: string; correctedQuery?: string;
      categories: { id: string; name: string; icon: string; colorHex: string; score: number; correctedQuery?: string }[];
      subServices: { id: string; name: string; categoryId: string; categoryName: string; categoryIcon: string; categoryColor: string; score: number }[];
      totalResults: number;
    }>(
      `/api/mobile/v2/search?q=${encodeURIComponent(q)}${lang ? `&lang=${lang}` : ''}`
    ),
  popular: () =>
    v2Request<{ results: any[] }>('/api/mobile/v2/search?popular=true'),
}

export interface AvailabilityResult {
  isAvailable: boolean
  reason: string
  workHours: { start: string; end: string }
  workDays: string[]
  nextAvailable?: string
}

export const v2Availability = {
  get: (providerId?: string) =>
    v2Request<AvailabilityResult>(
      `/api/mobile/v2/availability${providerId ? `?providerId=${providerId}` : ''}`
    ),
  update: (data: {
    monday?: boolean; tuesday?: boolean; wednesday?: boolean;
    thursday?: boolean; friday?: boolean; saturday?: boolean; sunday?: boolean;
    startTime?: string; endTime?: string; isAvailable?: boolean;
  }) => v2Request<{ success: boolean }>('/api/mobile/v2/availability', {
    method: 'PUT', body: JSON.stringify(data),
  }),
}

export interface QualityResult {
  providerId: string
  qualityScore: number
  avgReviewRating: number
  jobCompletionRate: number
  onTimeRate: number
  disputeRate: number
  totalJobs: number
  completedJobs: number
  isFlagged: boolean
  warnings: string[]
}

export const v2Quality = {
  get: (providerId?: string) =>
    v2Request<QualityResult>(
      `/api/mobile/v2/quality${providerId ? `?providerId=${providerId}` : ''}`
    ),
}

export interface TrustResult {
  customerId: string
  trustScore: number
  level: 'untrusted' | 'low' | 'normal' | 'high' | 'trusted'
  totalJobsPosted: number
  completedJobs: number
  cancelledJobs: number
  warnings: string[]
}

export const v2Trust = {
  get: (customerId?: string) =>
    v2Request<TrustResult>(
      `/api/mobile/v2/trust${customerId ? `?customerId=${customerId}` : ''}`
    ),
}

export interface ScheduleRecommendation {
  jobId: string
  title: string
  distance: number
  estimatedEarning: number
}

export const v2Schedule = {
  recommend: () =>
    v2Request<{ suggestedJobs: ScheduleRecommendation[]; totalEstimatedEarning: number; totalTravelKm: number }>(
      '/api/mobile/v2/schedule?action=recommend'
    ),
  cluster: () =>
    v2Request<{ clusters: any[] }>('/api/mobile/v2/schedule?action=cluster'),
}

export interface CustomJobRequestInput {
  title: string
  description: string
  categoryId?: string | null
  cityName?: string | null
  budgetMin?: number | null
  budgetMax?: number | null
}

export interface CustomJobRequest {
  id: string
  title: string
  description: string
  status: string
  adminNote?: string | null
  convertedJobId?: string | null
  createdAt: string
}

export const v2CustomJobs = {
  submit: (input: CustomJobRequestInput) =>
    v2Request<{ request: any }>('/api/mobile/v2/custom-jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  list: () =>
    v2Request<{ requests: CustomJobRequest[] }>('/api/mobile/v2/custom-jobs'),
}

export interface InspectionInput {
  inspectionFeeCents?: number
  currency?: string
  companyId?: string
}

export const v2Inspection = {
  create: (jobId: string, data?: InspectionInput) =>
    v2Request<{ success: boolean; inspectionId: string }>(
      `/api/mobile/v2/jobs/${jobId}/inspection`,
      { method: 'POST', body: JSON.stringify(data || {}) },
    ),
}

export interface EvidenceInput {
  inspectionId?: string
  evidenceType: string
  url?: string
  description?: string
  mimeType?: string
}

export const v2Evidence = {
  create: (jobId: string, data: EvidenceInput) =>
    v2Request<{ success: boolean; evidenceId: string }>(
      `/api/mobile/v2/jobs/${jobId}/evidence`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
}

export interface ChangeOrderInput {
  baseQuoteId: string
  reason: string
  amountDeltaCents: number | bigint | string
  scopeDelta?: string
  lineItems?: Array<{
    type: string
    description: string
    quantity: number
    unit: string
    unitAmountCents?: number | bigint | string
    totalAmountCents?: number | bigint | string
    currency: string
  }>
  companyId?: string
  status?: string
}

export const v2ChangeOrder = {
  create: (jobId: string, data: ChangeOrderInput) =>
    v2Request<{ success: boolean; changeOrderId: string }>(
      `/api/mobile/v2/jobs/${jobId}/change-orders`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
}

export interface TaskerProfileResult {
  id: string
  userId: string
  bio: string | null
  hourlyRate: number | null
  skills: string[]
  serviceAreas: string[]
  rating: number | null
  completedJobs: number
  isVerified: boolean
  isOnline: boolean
  latitude: number | null
  longitude: number | null
  profileImage: string | null
  user: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
    nickname: string | null
    identityStatus: string
  }
}

export const v2TaskerProfile = {
  get: () =>
    v2Request<TaskerProfileResult>('/api/mobile/taskers/profile'),
  update: (data: Record<string, any>) =>
    v2Request<{ success: boolean }>('/api/mobile/taskers/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
