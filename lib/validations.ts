import { z } from 'zod'

// Existing Maintainex validations
export const bookingSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Invalid phone number'),
  email: z.string().email('Invalid email address'),
  address: z.string().min(5, 'Address is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  serviceId: z.string().min(1, 'Please select a service'),
  subService: z.string().optional(),
  date: z.string().min(1, 'Please select a date'),
  time: z.string().min(1, 'Please select a time'),
  notes: z.string().optional(),
})

export const applicationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Invalid phone number'),
  email: z.string().email('Invalid email address'),
  address: z.string().min(5, 'Address is required'),
  position: z.string().min(1, 'Please select a position'),
  experience: z.string().min(10, 'Please describe your experience'),
})

export const serviceSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  slug: z.string().min(2, 'Slug is required'),
  description: z.string().min(10, 'Description is required'),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.number().optional(),
  isActive: z.boolean().default(true),
})

export const categorySchema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z.string().min(2, 'Slug is required'),
})

// New marketplace validations
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(9, 'Phone number must be at least 9 digits').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['CUSTOMER', 'TASKER']).default('CUSTOMER'),
})

export const taskerRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(9, 'Phone number must be at least 9 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
  hourlyRate: z.coerce.number().min(0, 'Hourly rate must be positive'),
  primaryDistrict: z.string().min(1, 'District is required'),
  serviceRadius: z.coerce.number().min(1).max(100).default(25),
  categoryIds: z.array(z.string()).min(1, 'Select at least one skill'),
})

export const taskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  categoryId: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  budgetType: z.enum(['fixed', 'hourly', 'negotiable']).default('fixed'),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  district: z.string().min(1, 'District is required'),
  province: z.string().optional(),
  address: z.string().optional(),
  isRemote: z.boolean().default(false),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isFlexibleDate: z.boolean().default(true),
  preferredTime: z.string().optional(),
  images: z.array(z.string()).optional(),
})

export const taskApplicationSchema = z.object({
  bidAmount: z.coerce.number().min(0).optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000),
  proposedDuration: z.string().optional(),
  availability: z.string().optional(),
})

export const taskAssignmentSchema = z.object({
  taskId: z.string(),
  taskerId: z.string(),
  agreedPrice: z.coerce.number().min(0),
  agreedDuration: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export const reviewSchema = z.object({
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
  professionalism: z.coerce.number().min(1).max(5).optional(),
  punctuality: z.coerce.number().min(1).max(5).optional(),
  quality: z.coerce.number().min(1).max(5).optional(),
  communication: z.coerce.number().min(1).max(5).optional(),
  value: z.coerce.number().min(1).max(5).optional(),
})

export const chatMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  messageType: z.enum(['text', 'image', 'file', 'system']).default('text'),
  imageUrl: z.string().optional(),
  fileUrl: z.string().optional(),
})

export type BookingFormData = z.infer<typeof bookingSchema>
export type ApplicationFormData = z.infer<typeof applicationSchema>
export type ServiceFormData = z.infer<typeof serviceSchema>
export type CategoryFormData = z.infer<typeof categorySchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type TaskerRegisterInput = z.infer<typeof taskerRegisterSchema>
export type TaskInput = z.infer<typeof taskSchema>
export type TaskApplicationInput = z.infer<typeof taskApplicationSchema>
export type TaskAssignmentInput = z.infer<typeof taskAssignmentSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
export type ChatMessageInput = z.infer<typeof chatMessageSchema>
