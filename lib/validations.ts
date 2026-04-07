import { z } from 'zod'

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

export type BookingFormData = z.infer<typeof bookingSchema>
export type ApplicationFormData = z.infer<typeof applicationSchema>
export type ServiceFormData = z.infer<typeof serviceSchema>
export type CategoryFormData = z.infer<typeof categorySchema>
