export type ProviderType = 'INDIVIDUAL' | 'COMPANY'

export type JobMode = 'BOOK_NOW' | 'QUOTE' | 'PROJECT' | 'RECURRING'

export type UrgencyLevel = 'NORMAL' | 'URGENT' | 'EMERGENCY'

export type MatchExclusionReason =
  | 'IDENTITY_NOT_VERIFIED'
  | 'PROVIDER_SUSPENDED'
  | 'PROVIDER_BANNED'
  | 'PROVIDER_NOT_FOUND'
  | 'NO_PROVIDER_PROFILE'
  | 'PROVIDER_VERIFICATION_NOT_APPROVED'
  | 'NO_SERVICE_CAPABILITIES'
  | 'CAPABILITY_MISMATCH'
  | 'OUTSIDE_SERVICE_AREA'
  | 'UNAVAILABLE'
  | 'COMPANY_NOT_VERIFIED'
  | 'COMPANY_OWNER_SUSPENDED'
  | 'COMPANY_OWNER_BANNED'
  | 'NO_ACTIVE_COMPANY_OWNER'
  | 'COMPANY_SUBSCRIPTION_CANCELLED'
  | 'NOT_ACTIVE_COMPANY_MEMBER'
  | 'CROSS_COMPANY_DENIED'

export interface MatchCandidate {
  providerId: string
  providerType: ProviderType
  companyId?: string
  userId?: string
  score: number
  rank: number
  scoreVersion: string
  components: ScoreComponents
  reasons: string[]
}

export interface ScoreComponents {
  capability: number
  reliability: number
  reputation: number
  availability: number
  travel: number
  experience: number
}

export interface MatchResult {
  jobId: string
  candidates: MatchCandidate[]
  excluded: ExcludedProvider[]
  scoreVersion: string
  generatedAt: Date
}

export interface ExcludedProvider {
  providerId: string
  providerType: ProviderType
  reason: MatchExclusionReason
  detail?: string
}

export interface MatchingConfig {
  countryCode: string
  matchingVersion: string
  weights: ScoreComponents
}

export interface MatchingInput {
  jobId: string
  companyId?: string
  userId?: string
  jobMode: JobMode
  urgency: UrgencyLevel
  categoryId: string
  serviceTemplateId?: string
  latitude?: number | null
  longitude?: number | null
  countryCode?: string
}
