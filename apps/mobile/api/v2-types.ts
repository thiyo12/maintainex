export interface V2Escrow {
  id: string
  jobId: string
  quoteId: string
  customerId: string
  providerId: string
  amount: number
  serviceFee: number
  totalAmount: number
  currency: string
  paymentMethod: string
  status: string
  heldAt?: string | null
  releasedAt?: string | null
  refundedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface V2Workspace {
  id?: string
  jobId?: string
  progressStatus: string
  completionRequestedAt?: string | null
  completedAt?: string | null
  updatedAt?: string
}

export interface V2CompanyAssignment {
  id: string
  workerUserId: string
  status: 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'REVOKED'
  assignedAt: string
  acceptedAt: string | null
  startedAt: string | null
  completedAt: string | null
  worker?: { id: string; name: string | null } | null
}

export interface V2ProviderSummary {
  id: string
  userId?: string
  name?: string | null
  profileImage?: string | null
  avatar?: string | null
  rating?: number | null
  completedJobs?: number
  isVerified?: boolean
  isOnline?: boolean
  latitude?: number | null
  longitude?: number | null
  categories?: any[]
}

export interface V2Quote {
  id: string
  jobId: string
  providerId: string
  providerType: 'INDIVIDUAL' | 'COMPANY'
  price: number
  currency: string
  estimatedCompletionTime: string
  message?: string | null
  attachments: string[]
  status: string
  revisionNumber?: number
  parentQuoteId?: string | null
  revisionReason?: string | null
  createdAt: string
  provider?: V2ProviderSummary | null
  providerRating?: number
  completedJobs?: number
}

export interface V2Job {
  id: string
  customerId: string
  title: string
  description: string
  categoryId: string
  countryCode: string
  photos: string[]
  budgetType: string
  budgetAmount: number | null
  areaId: string | null
  postalCode: string | null
  preferredDate: string | null
  timeSlot?: string | null
  preferredTimeSlot: string | null
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
  escrow?: V2Escrow | null
  workspace?: V2Workspace | null
  reviews?: any
  companyAssignment?: V2CompanyAssignment | null
  acceptedQuote?: (V2Quote & { provider?: V2ProviderSummary | null }) | null
  smartBooking?: any
}

export interface V2PaymentOptions {
  countryCode: string
  currency: string | null
  cash: {
    available: boolean
    marketAvailable: boolean
    financiallyAllowed: boolean
    reason: string | null
  }
  online: {
    available: boolean
    marketAvailable: boolean
    financiallyAllowed: boolean
    provider: string | null
    paymentMethods: string[]
    reason: string | null
  }
}

export interface V2PaymentStatus {
  id: string
  status: 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUND_REQUIRED' | 'REFUND_PROCESSING' | 'REFUNDED' | 'CHARGEDBACK'
  amount: number
  amountMinor: string
  currency: string
  merchantOrderId: string
  paymentId: string | null
  gateway: string
  createdAt: string
  paidAt: string | null
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

export interface SearchResult {
  id: string
  name: string
  slug: string
  score: number
  matchType: string
  subcategories: string[]
}

export interface AvailabilityResult {
  isAvailable: boolean
  reason: string
  workHours: { start: string; end: string }
  workDays: string[]
  nextAvailable?: string
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

export interface TrustResult {
  customerId: string
  trustScore: number
  level: 'untrusted' | 'low' | 'normal' | 'high' | 'trusted'
  totalJobsPosted: number
  completedJobs: number
  cancelledJobs: number
  warnings: string[]
}

export interface ScheduleRecommendation {
  jobId: string
  title: string
  distance: number
  estimatedEarning: number
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

export interface InspectionInput {
  inspectionFeeCents?: number
  currency?: string
  companyId?: string
}

export interface EvidenceInput {
  inspectionId?: string
  evidenceType: string
  url?: string
  description?: string
  mimeType?: string
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
