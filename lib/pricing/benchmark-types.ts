export type PricingMode = 'INSTANT_PRICE' | 'SMART_QUOTE' | 'INSPECTION_FIRST'

export type BenchmarkSourceType =
  | 'MAINTAINEX_COMPLETED_JOBS'
  | 'MANUAL_MARKET_RESEARCH'
  | 'PUBLIC_PROVIDER_PRICE'
  | 'PARTNER_DATA'
  | 'ADMIN_ESTIMATE'
  | 'OTHER'

export type BenchmarkStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED'

export type QuoteClassification =
  | 'VERY_LOW'
  | 'BELOW_TYPICAL'
  | 'TYPICAL'
  | 'ABOVE_TYPICAL'
  | 'VERY_HIGH'
  | 'INSUFFICIENT_DATA'

export type LineItemType =
  | 'LABOUR'
  | 'MATERIALS'
  | 'CALL_OUT'
  | 'DIAGNOSIS'
  | 'TRAVEL'
  | 'EQUIPMENT'
  | 'PERMIT'
  | 'OTHER'
  | 'TAX'
  | 'PLATFORM_SERVICE_CHARGE'

export type GeographyLevel = 'CITY' | 'PROVINCE' | 'COUNTRY' | 'NONE'

export interface BenchmarkResolution {
  benchmarkId: string
  serviceTemplateId: string
  countryCode: string
  region: string | null
  city: string | null
  currency: string
  pricingMode: PricingMode
  sampleSize: number
  medianAmountCents: bigint
  lowerPercentileCents: bigint
  upperPercentileCents: bigint
  minimumObservedCents: bigint | null
  maximumObservedCents: bigint | null
  sourceType: BenchmarkSourceType
  sourceReference: string | null
  methodologyNote: string | null
  version: number
  effectiveFrom: Date | null
  effectiveTo: Date | null
  geographyLevel: GeographyLevel
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface BenchmarkConfig {
  minBenchmarkSample: number
  benchmarkPercentileLow: number
  benchmarkPercentileHigh: number
  benchmarkOutlierIqrMult: number
  benchmarkFallbackEnabled: boolean
  benchmarkResearchIntervalMonths: number
}

export interface QuoteLineItemInput {
  type: LineItemType
  description: string
  quantity: number
  unit?: string
  unitAmountCents: bigint
  currency: string
  sortOrder?: number
  metadata?: string
}

export interface QuoteTotalValidation {
  valid: boolean
  serverSubtotalCents: bigint
  serverTaxCents: bigint
  serverTotalCents: bigint
  submittedSubtotalCents: bigint | null
  submittedTotalCents: bigint | null
  mismatch: boolean
  errors: string[]
}

export interface StatisticalResult {
  median: bigint
  p25: bigint
  p75: bigint
  min: bigint
  max: bigint
  sampleSize: number
  outlierCount: number
  outlierIds: string[]
}

export interface BenchmarkLearnInput {
  serviceTemplateId: string
  countryCode: string
  region?: string
  city?: string
  currency: string
  pricingMode: PricingMode
  sourceType: BenchmarkSourceType
  sourceReference?: string
  methodologyNote?: string
  createdBy?: string
}
