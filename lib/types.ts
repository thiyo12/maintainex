export type UserRole = 'CUSTOMER' | 'TASKER' | 'ADMIN' | 'SUPER_ADMIN'

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_VERIFICATION'

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export type TaskStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED'

export type TaskApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'

export type TaskAssignmentStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED'

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'ESCROW' | 'RELEASED'

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'STRIPE' | 'WHATSAPP_PAY'

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED'

export type DisputeResolution = 'REFUND_FULL' | 'REFUND_PARTIAL' | 'NO_ACTION' | 'TASKER_COMPENSATION'

export type NotificationType =
  | 'TASK_CREATED' | 'TASK_APPROVED' | 'TASK_REJECTED'
  | 'APPLICATION_RECEIVED' | 'APPLICATION_ACCEPTED' | 'APPLICATION_REJECTED'
  | 'TASK_ASSIGNED' | 'TASK_COMPLETED'
  | 'PAYMENT_RECEIVED' | 'PAYMENT_RELEASED' | 'PAYMENT_FAILED'
  | 'REVIEW_RECEIVED' | 'REVIEW_RESPONSE'
  | 'MESSAGE_RECEIVED'
  | 'DISPUTE_OPENED' | 'DISPUTE_RESOLVED'
  | 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED'
  | 'SYSTEM_ALERT' | 'REMINDER' | 'WHATSAPP_SENT'

export type BackgroundCheckStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED_CLEAR' | 'COMPLETED_FLAGGED' | 'EXPIRED'

export type CustomerType = 'REGULAR' | 'VIP' | 'CORPORATE' | 'POTENTIAL'

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: UserRole
  status: UserStatus
  isActive: boolean
  avatarUrl?: string
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomerProfile {
  id: string
  userId: string
  customerType: CustomerType
  status: CustomerStatus
  totalBookings: number
  totalTasks: number
  totalSpent: number
  lifetimeValue: number
  walletBalance: number
  province?: string
  defaultDistrict?: string
  preferredContact?: string
  createdAt: string
  updatedAt: string
  user?: User
}

export interface TaskerProfile {
  id: string
  userId: string
  bio?: string
  profileImage?: string
  hourlyRate: number
  minimumJobPrice: number
  primaryDistrict?: string
  serviceRadius: number
  isAvailable: boolean
  overallRating: number
  totalReviews: number
  totalTasksCompleted: number
  totalEarnings: number
  responseTime?: number
  completionRate?: number
  acceptanceRate?: number
  backgroundCheckStatus: BackgroundCheckStatus
  verified: boolean
  badges?: string
  createdAt: string
  updatedAt: string
  user?: User
  skills?: TaskerSkill[]
}

export interface TaskerSkill {
  id: string
  taskerId: string
  categoryId: string
  experienceLevel: string
  certified: boolean
  hourlyRate?: number
  category?: Category
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  image?: string
  coverImage?: string
  displayOrder: number
  isActive: boolean
  createdAt: string
  services?: Service[]
}

export interface Service {
  id: string
  name: string
  slug?: string
  description: string
  shortDescription?: string
  categoryId: string
  price: number
  duration: number
  features: string[]
  image?: string
  displayOrder: number
  views: number
  isTrending: boolean
  isActive: boolean
  createdAt: string
  category?: Category
}

export interface Task {
  id: string
  title: string
  description: string
  categoryId?: string
  customerId: string
  budget?: number
  budgetType: string
  urgency?: string
  district?: string
  province?: string
  address?: string
  isRemote: boolean
  startDate?: string
  endDate?: string
  isFlexibleDate: boolean
  status: TaskStatus
  adminNotes?: string
  reviewedBy?: string
  reviewedAt?: string
  rejectionReason?: string
  views: number
  applicationsCount: number
  publishedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  category?: Category
  customer?: CustomerProfile
  images?: string
  applications?: TaskApplication[]
  assignment?: TaskAssignment
}

export interface TaskApplication {
  id: string
  taskId: string
  taskerId: string
  bidAmount?: number
  message?: string
  proposedDuration?: string
  availability?: string
  status: TaskApplicationStatus
  viewedAt?: string
  respondedAt?: string
  createdAt: string
  updatedAt: string
  task?: Task
  tasker?: TaskerProfile
}

export interface TaskAssignment {
  id: string
  taskId: string
  taskerId: string
  customerId: string
  status: TaskAssignmentStatus
  agreedPrice: number
  agreedDuration?: string
  assignedBy?: string
  startDate?: string
  endDate?: string
  startedAt?: string
  completedAt?: string
  notes?: string
  completionPhotos?: string
  customerFeedback?: string
  createdAt: string
  updatedAt: string
  task?: Task
  tasker?: TaskerProfile
  customer?: CustomerProfile
  payment?: Payment
  review?: Review
}

export interface Booking {
  id: string
  userId?: string
  serviceId?: string
  branchId?: string
  taskId?: string
  date: string
  timeSlot: string
  status: BookingStatus
  notes?: string
  totalPrice: number
  name?: string
  phone?: string
  email?: string
  district?: string
  province?: string
  address?: string
  time?: string
  assignedTo?: string
  createdAt: string
  updatedAt: string
  service?: Service
  branch?: Branch
  task?: Task
}

export interface Branch {
  id: string
  name: string
  address: string
  city: string
  phone?: string
  location?: string
  districts?: string
  province?: string
  isActive: boolean
  createdAt: string
}

export interface Payment {
  id: string
  assignmentId?: string
  bookingId?: string
  customerId: string
  taskerId: string
  amount: number
  platformFee: number
  taskerPayout: number
  currency: string
  status: PaymentStatus
  method: PaymentMethod
  stripePaymentIntentId?: string
  invoiceNumber?: string
  paidAt?: string
  releasedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Review {
  id: string
  userId?: string
  serviceId?: string
  taskId?: string
  assignmentId?: string
  customerId?: string
  taskerId?: string
  rating: number
  professionalism?: number
  punctuality?: number
  quality?: number
  communication?: number
  value?: number
  comment?: string
  isPublic: boolean
  isVerified: boolean
  helpfulCount: number
  response?: string
  respondedAt?: string
  status: string
  createdAt: string
  updatedAt: string
  service?: Service
  task?: Task
  customer?: CustomerProfile
  tasker?: TaskerProfile
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: string
  isRead: boolean
  readAt?: string
  actionUrl?: string
  createdAt: string
  user?: User
}

export interface ChatMessage {
  id: string
  assignmentId?: string
  taskId?: string
  senderId: string
  receiverId: string
  content: string
  messageType: string
  imageUrl?: string
  fileUrl?: string
  fileName?: string
  isRead: boolean
  readAt?: string
  createdAt: string
  updatedAt: string
  sender?: User
  receiver?: User
}

export interface Dispute {
  id: string
  taskId: string
  customerId: string
  taskerId: string
  adminId?: string
  status: DisputeStatus
  reason: string
  description: string
  resolution?: DisputeResolution
  resolutionNotes?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  type: string
  branchId: string
  bookingId?: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: string
  subtotal: number
  tax: number
  total: number
  status: string
  paymentStatus: string
  amountPaid: number
  dueDate?: string
  notes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface AdminProfile {
  id: string
  userId: string
  role: string
  province?: string
  branchId?: string
  canEditServices: boolean
  createdAt: string
  updatedAt: string
}

export interface Session {
  user: User
  expires: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
