import { z } from 'zod'

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const verifyTotpSchema = z.object({
  tempToken: z.string().min(1),
  totpCode: z.string().length(6),
})

// User management schemas
export const userQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  role: z.enum(['JOB_POSTER', 'TASKER', 'COMPANY']).optional(),
  country: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
  kyc: z.enum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
})

export const suspendUserSchema = z.object({
  reason: z.string().min(1).max(500),
})

export const banUserSchema = z.object({
  reason: z.string().min(1).max(500),
})

// KYC schemas
export const kycQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
})

export const rejectKycSchema = z.object({
  reason: z.string().min(1).max(500),
})

// Job schemas
export const jobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().optional(),
  status: z.string().optional(),
  country: z.string().optional(),
  category: z.string().optional(),
})

export const cancelJobSchema = z.object({
  reason: z.string().min(1).max(500),
})

// Escrow schemas
export const escrowQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: z.string().optional(),
  country: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const releaseEscrowSchema = z.object({})
export const refundEscrowSchema = z.object({
  reason: z.string().min(1).max(500),
})

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
  countries: z.array(z.string()).optional(),
})

export const updateCategorySchema = createCategorySchema.partial()

// Admin management schemas
export const createAdminSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT']),
  assignedCountries: z.array(z.string()).default([]),
})

export const updateAdminSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT']).optional(),
  assignedCountries: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

// Settings schema
export const updateSettingsSchema = z.object({
  platformFeeBps: z.coerce.number().int().min(0).max(10000).optional(),
  minJobAmountCents: z.coerce.number().int().min(0).optional(),
  maxJobAmountCents: z.coerce.number().int().min(0).optional(),
  escrowReleaseDays: z.coerce.number().int().min(1).max(90).optional(),
  supportEmail: z.string().email().optional(),
})

// Audit log schema
export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  action: z.string().optional(),
  targetTable: z.string().optional(),
  adminId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})
