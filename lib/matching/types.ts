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
  | 'ASSIGNMENT_CONFLICT'
  | 'PROFESSION_MISMATCH'
  | 'SKILL_MISMATCH'
  | 'CREDENTIAL_REQUIRED'
  | 'JURISDICTION_CREDENTIAL_REQUIRED'
  | 'QUALITY_FLOOR'
  | 'COMPANY_NOT_VERIFIED'
  | 'COMPANY_OWNER_SUSPENDED'
  | 'COMPANY_OWNER_BANNED'
  | 'NO_ACTIVE_COMPANY_OWNER'
  | 'COMPANY_SUBSCRIPTION_CANCELLED'
  | 'NOT_ACTIVE_COMPANY_MEMBER'
  | 'CROSS_COMPANY_DENIED'
  | 'NO_APPROVED_PROFESSION'

export type OpportunityStatus = 'PENDING' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN' | 'CANCELLED'

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
  fairness: number
  preferredSkill: number
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
  wave1Size: number
  wave2Size: number
  wave3Size: number
  wave1ExpiryMinutes: number
  wave2ExpiryMinutes: number
  wave3ExpiryMinutes: number
  newProviderBaseline: number
  maxOpportunityBoost: number
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

export interface EligibilityGate {
  gate: string
  passed: boolean
  reason?: string
  detail?: string
}

export interface EligibilityResult {
  eligible: boolean
  gates: EligibilityGate[]
  matchedProfessionId: string | null
  matchedSkills: string[]
  preferredSkillsMatched: string[]
  jurisdictionPassed: boolean
  serviceAreaPassed: boolean
  availabilityPassed: boolean
}

export interface ProviderOpportunityRecord {
  id: string
  jobId: string
  taskerId: string | null
  companyId: string | null
  providerType: ProviderType
  waveNumber: number
  status: OpportunityStatus
  sentAt: Date | null
  expiresAt: Date | null
  respondedAt: Date | null
  response: string | null
  rankAtSend: number | null
  scoreSnapshot: number | null
  eligibilitySnapshot: string | null
}

export interface WaveConfig {
  waveNumber: number
  size: number
  expiryMinutes: number
}

export interface FairnessSignals {
  opportunitiesLast7Days: number
  opportunitiesLast30Days: number
  jobsWonLast7Days: number
  jobsWonLast30Days: number
  daysSinceLastOpportunity: number
  daysSinceLastCompletedJob: number
}

export interface RankingInput {
  providerId: string
  providerType: ProviderType
  eligibility: EligibilityResult
  profileData: {
    rating: number
    completedJobs: number
    compositeScore: number
    createdAt: Date
    latitude: number | null
    longitude: number | null
  }
  jobData: {
    latitude: number | null
    longitude: number | null
    urgency: UrgencyLevel
  }
  fairness: FairnessSignals
}
