export type CountryCode = 'LK' | 'CA'
export type CurrencyCode = 'LKR' | 'CAD'
export type UrgencyLevel = 'normal' | 'urgent' | 'emergency'
export type ComplexityLevel = 'simple' | 'medium' | 'complex'
export type TimeOfDay = 'day' | 'night'
export type DemandLevel = 'low' | 'normal' | 'high' | 'surge'
export type MarketComparison = 'below_average' | 'average' | 'slightly_above' | 'premium'
export type Confidence = 'high' | 'medium' | 'low'
export type MaterialHandling = 'tasker_brings' | 'customer_provides' | 'quote_both'

export interface PriceEstimateRequest {
  categoryId: string
  categoryName?: string
  description: string
  title?: string
  areaId?: string
  cityId?: string
  stateId?: string
  countryCode?: CountryCode
  urgency?: UrgencyLevel
  preferredDate?: string
  preferredTime?: TimeOfDay
  estimatedDuration?: number
  workersCount?: number
  materialHandling?: MaterialHandling
}

export interface PriceBreakdownItem {
  label: string
  amount: number
  amountRange?: { min: number; max: number }
}

export interface MarketInsight {
  comparison: MarketComparison
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
  currency: CurrencyCode
  symbol: string
  priceRange: { min: number; max: number; base: number }
  breakdown: PriceBreakdownItem[]
  marketInsight: MarketInsight
  timeEstimate: string
  confidence: Confidence
  warning: string | null
  suggestion: string | null
  materialHandling?: MaterialHandling
  materials?: DetectedMaterial[]
  totalMaterialCost?: number
  labourOnlyRange?: { min: number; max: number }
  withMaterialsRange?: { min: number; max: number }
}

export interface PricingModelWeights {
  baseRate: number
  complexityMultiplier: number
  urgencyMultiplier: number
  weekendMultiplier: number
  nightMultiplier: number
  travelCostPerKm: number
  materialCostFactor: number
  demandMultiplier: number
}

export const COMPLEXITY_KEYWORDS = {
  simple: ['basic', 'simple', 'light', 'quick', 'mini', 'small', 'easy', 'standard'],
  medium: ['repair', 'fix', 'install', 'assembly', 'mounting', 'replace', 'service'],
  complex: ['deep', 'heavy', 'full', 'complete', 'complex', 'large', 'commercial', 'industrial', 'major', 'overhaul', 'renovation', 'remodel'],
}

export const URGENCY_MULTIPLIERS: Record<UrgencyLevel, number> = {
  normal: 1.0,
  urgent: 1.15,
  emergency: 1.35,
}

export const TIME_MULTIPLIERS = {
  day: 1.0,
  night: 1.1,
  weekend: 1.2,
  holiday: 1.3,
}
