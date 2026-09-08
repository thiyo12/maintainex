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
