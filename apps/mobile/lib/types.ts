export type UserRole = 'CUSTOMER' | 'TASKER' | 'COMPANY' | 'ADMIN'

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: UserRole
  isActive: boolean
  createdAt: string
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

export interface TaskerProfile {
  id: string
  userId: string
  user: User
  bio: string
  hourlyRate: number
  skills: string[]
  serviceAreas: string[]
  rating: number
  completedJobs: number
  isVerified: boolean
  isOnline: boolean
  profileImage?: string
  createdAt: string
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
