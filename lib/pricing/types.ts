export type PricingMode = 'BOOK_NOW' | 'QUOTE' | 'PROJECT' | 'RECURRING'

export type UrgencyLevel = 'NORMAL' | 'URGENT' | 'EMERGENCY'

export interface PricingInput {
  jobId: string
  categoryId: string
  serviceTemplateId?: string
  mode: PricingMode
  urgency: UrgencyLevel
  quantity?: number
  durationMinutes?: number
  countryCode?: string
  providerId?: string
  providerType?: 'INDIVIDUAL' | 'COMPANY'
}

export interface PriceBreakdown {
  baseAmount: bigint
  urgencyAmount: bigint
  serviceModifiers: bigint
  providerGross: bigint
  platformFeeBps: number
  platformFeeAmount: bigint
  customerTotal: bigint
  currency: string
  pricingVersion: string
  ruleIds: string[]
}

export interface PriceSnapshotData {
  jobId: string
  pricingVersion: string
  currency: string
  baseAmount: bigint
  urgencyAmount: bigint
  serviceModifiers: bigint
  platformFeeBps: number
  platformFeeAmount: bigint
  providerGross: bigint
  customerTotal: bigint
  ruleIds: string[]
}

export interface PricingConfig {
  countryCode: string
  pricingVersion: string
  commissionRateBps: number
  urgentModifierBps: number
  emergencyModifierBps: number
  urgencyCapBps: number
  minJobAmountCents: bigint
  maxJobAmountCents: bigint
}
