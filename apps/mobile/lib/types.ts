export type UserRole = 'CUSTOMER' | 'TASKER' | 'COMPANY'

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: UserRole
  isActive: boolean
  createdAt: string
  identityStatus?: string
  nickname?: string
  profileImage?: string
  lastNameChangedAt?: string
  needsOnboarding?: boolean
  tierLevel?: 'EXPLORER' | 'REGULAR' | 'PREMIUM' | 'ELITE'
  completedJobs?: number
  totalSpent?: number
  phoneVerified?: boolean
  availableProfiles?: UserRole[]
  activeCompany?: { companyId: string; role: string } | null
  birthday?: string
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
  language?: 'EN' | 'TA' | 'SI'
  emergencyContact?: string
  province?: string
  region?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Category {
  id: string
  name: string
  slug: string
  image?: string
  description?: string
  services: Service[]
}

export interface Service {
  id: string
  name: string
  title: string
  price: number
  description?: string
  image?: string
  categoryId?: string
}

export interface Booking {
  id: string
  serviceId: string
  serviceName: string
  categoryName: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  district: string
  address?: string
  date: string
  time: string
  notes?: string
  price: number
  status: string
  createdAt: string
  userId?: string
}

/**
 * Phase 03: the server may return a reduced public profile when the viewer has
 * no same-market active transaction. Private fields are ABSENT (not null), so
 * every field below except the public ones is optional and must be guarded.
 */
export interface TaskerProfile {
  /** Public provider profile id. Not the private account user id. */
  id: string
  name?: string
  marketLabel?: string | null
  /**
   * Phase 03 tiers:
   *  PUBLIC      — same-market eligible viewer, normal commercial information
   *  TRANSACTION — same-market viewer with an active job
   *  REDUCED     — out-of-market/unverifiable viewer; private fields omitted
   */
  visibility?: 'PUBLIC' | 'TRANSACTION' | 'REDUCED'
  userId?: string
  user?: User
  bio: string
  hourlyRate?: number
  skills: string[]
  serviceAreas?: string[]
  rating: number
  completedJobs: number
  isVerified?: boolean
  isOnline?: boolean
  profileImage?: string
  /** Broad approved coverage areas for eligible same-market viewers. */
  coverageAreas?: string[]
  reviews?: Array<{
    id: string
    rating: number
    comment: string
    createdAt: string
  }>
  /** Only present on an authorised transaction tier. */
  activeJobId?: string
  createdAt?: string
}

export interface TaskerLocation {
  latitude: number
  longitude: number
  lastUpdated: string
  heading?: number
  speed?: number
}

export interface JobPosting {
  id: string
  customerId: string
  customer: User
  title: string
  description: string
  category: string
  budget: number
  location: string
  latitude?: number
  longitude?: number
  scheduledDate?: string
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
  bids: Bid[]
  assignedTasker?: TaskerProfile
}

export interface Bid {
  id: string
  jobId: string
  taskerId: string
  tasker: TaskerProfile
  amount: number
  message: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  createdAt: string
}

export interface Assignment {
  id: string
  jobId: string
  taskerId: string
  status: 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  startedAt?: string
  completedAt?: string
  taskerLocation?: TaskerLocation
}

export interface Review {
  id: string
  rating: number
  comment: string
  reviewerId: string
  taskerId: string
  jobId: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  data?: Record<string, string>
  read: boolean
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiError {
  error: string
  message: string
  statusCode: number
}

// Find a Tasker - Job Section Types
export interface JobCategory {
  id: string
  name: string
  iconName: string
  colorHex: string
  sortOrder: number
  countries: string[]
  isActive: boolean
  jobs?: TemplateJob[]
}

export interface TemplateJob {
  id: string
  categoryId: string
  category?: JobCategory
  name: string
  description: string
  whatIsIncluded: string[]
  typicalDurationMinutes: number
  priceMin: number
  priceMax: number
  currency: string
  isPopular: boolean
  isCompanyOnly: boolean
  countries: string[]
}

/**
 * Phase 03: 'REDUCED' responses carry public identity only — private fields are
 * absent, so they are optional and screens must guard before rendering.
 */
export interface FindTaskerResult {
  id: string
  userId?: string
  name: string
  bio: string
  rating: number
  completedJobs: number
  marketLabel?: string | null
  visibility?: 'PUBLIC' | 'TRANSACTION' | 'REDUCED'
  isVerified?: boolean
  isOnline?: boolean
  profileImage?: string
  latitude?: number
  longitude?: number
  distance?: number
  skills: string[]
  hourlyRate?: number
  fixedRate?: number
  experienceYears?: number
  serviceAreas?: string[]
  reviews?: Array<{
    id: string
    rating: number
    comment: string
    createdAt: string
  }>
  activeJobId?: string
}

export interface TaskerSkill {
  id: string
  taskerId: string
  jobId: string
  job: TemplateJob
  experienceYears: number
  hourlyRate: number
  fixedRate: number
  currency: string
}

export interface QuickBookingInput {
  jobId: string
  taskerId: string
  date: string
  timeSlot: string
  address: string
  district: string
  notes?: string
}

export interface QuickBooking {
  id: string
  jobId: string
  taskerId: string
  customerId: string
  date: string
  timeSlot: string
  status: string
  totalPrice: number
  createdAt: string
}

export interface SearchResult {
  categories: JobCategory[]
  jobs: TemplateJob[]
  taskers: FindTaskerResult[]
  totalResults: number
}
