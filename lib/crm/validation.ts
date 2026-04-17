import { z } from 'zod'

export const customerSearchSchema = z.object({
  query: z.string().min(1).max(100).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'totalSpent', 'totalBookings']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).optional(),
  customerType: z.enum(['REGULAR', 'VIP', 'CORPORATE', 'POTENTIAL']).optional(),
  province: z.string().optional(),
  source: z.string().optional(),
  minBookings: z.coerce.number().min(0).optional(),
  maxBookings: z.coerce.number().min(0).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const customerCreateSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
  customerType: z.enum(['REGULAR', 'VIP', 'CORPORATE', 'POTENTIAL']).default('REGULAR'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).default('ACTIVE'),
  preferredContact: z.enum(['EMAIL', 'PHONE', 'WHATSAPP']).optional(),
  source: z.string().optional(),
  sourceDetails: z.string().optional(),
  province: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export const customerUpdateSchema = customerCreateSchema.partial()

export const customerNoteSchema = z.object({
  content: z.string().min(1).max(2000),
  type: z.enum(['GENERAL', 'COMPLAINT', 'FEEDBACK', 'INTERNAL']).default('GENERAL'),
  isPrivate: z.boolean().default(false),
})

export const customerTagSchema = z.object({
  name: z.string().min(2).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366f1'),
  description: z.string().max(200).optional(),
  type: z.enum(['GENERAL', 'BEHAVIOR', 'VALUE', 'PREFERENCE']).default('GENERAL'),
})

export const customerSegmentSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  criteria: z.record(z.any()),
  type: z.enum(['DYNAMIC', 'STATIC']).default('DYNAMIC'),
})

export const communicationSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'NOTIFICATION', 'CALL']),
  direction: z.enum(['OUTBOUND', 'INBOUND']),
  subject: z.string().max(200).optional(),
  content: z.string().min(1).max(5000),
  customerId: z.string(),
  status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED']).optional(),
})

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 5000)
}

export function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, '').substring(0, 20)
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/
  return phoneRegex.test(phone) && phone.replace(/[^0-9]/g, '').length >= 10
}