export type KycStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'SUSPENDED'

export const KYC_VALID_TRANSITIONS: Record<KycStatus, KycStatus[]> = {
  NOT_SUBMITTED: ['PENDING'],
  PENDING: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['SUSPENDED', 'EXPIRED'],
  REJECTED: ['PENDING'],
  EXPIRED: ['PENDING'],
  SUSPENDED: ['PENDING'],
}

export type CompanyVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED'

export const COMPANY_VERIFICATION_TRANSITIONS: Record<CompanyVerificationStatus, CompanyVerificationStatus[]> = {
  UNVERIFIED: ['PENDING'],
  PENDING: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['SUSPENDED'],
  REJECTED: ['PENDING'],
  SUSPENDED: ['PENDING'],
}

export function isValidKycTransition(from: KycStatus, to: KycStatus): boolean {
  return KYC_VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function isValidCompanyVerificationTransition(from: CompanyVerificationStatus, to: CompanyVerificationStatus): boolean {
  return COMPANY_VERIFICATION_TRANSITIONS[from]?.includes(to) ?? false
}

export function isKycVerified(status: KycStatus): boolean {
  return status === 'VERIFIED'
}

export function isCompanyVerified(status: CompanyVerificationStatus): boolean {
  return status === 'VERIFIED'
}

export function isProviderEligibleForWork(params: {
  identityStatus: string
  providerVerificationStatus: string
  isSuspended: boolean
  isBanned: boolean
  hasActiveMembership: boolean
}): boolean {
  if (params.isSuspended || params.isBanned) return false
  if (params.identityStatus !== 'VERIFIED') return false
  if (params.providerVerificationStatus !== 'VERIFIED') return false
  return true
}

export function isCompanyEligibleForJobs(params: {
  verificationStatus: string
  isSuspended: boolean
  isBanned: boolean
  hasActiveOwner: boolean
  subscriptionStatus: string
}): boolean {
  if (params.isSuspended || params.isBanned) return false
  if (params.verificationStatus !== 'VERIFIED') return false
  if (!params.hasActiveOwner) return false
  if (params.subscriptionStatus === 'CANCELLED') return false
  return true
}

export function isWorkerEligibleForAssignment(params: {
  membershipStatus: string
  isSuspended: boolean
  isBanned: boolean
  identityStatus: string
  hasRequiredCapability: boolean
}): boolean {
  if (params.membershipStatus !== 'ACTIVE') return false
  if (params.isSuspended || params.isBanned) return false
  if (params.identityStatus !== 'VERIFIED') return false
  if (!params.hasRequiredCapability) return false
  return true
}
